/**
 * Bundle Size Checker
 *
 * [불변 규칙] Initial Load Bundle ≤ 500KB (초과 시 빌드 실패)
 *
 * Initial Load Bundle = index.html에서 직접 로드되는 모든 JS/CSS 파일의 합
 */

const fs = require('fs');
const path = require('path');

const MAX_BUNDLE_SIZE = 500 * 1024; // 500KB

/**
 * 재귀적으로 디렉토리 내의 모든 파일을 찾습니다
 */
function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    const filePath = path.join(dirPath, file);
    if (fs.statSync(filePath).isDirectory()) {
      arrayOfFiles = getAllFiles(filePath, arrayOfFiles);
    } else {
      arrayOfFiles.push(filePath);
    }
  });

  return arrayOfFiles;
}

/**
 * index.html에서 직접 로드되는 파일들을 찾습니다
 *
 * [중요] modulepreload는 초기 로드가 아닙니다.
 * 실제로 즉시 실행되는 script 태그와 CSS만 초기 로드로 계산합니다.
 */
function getInitialLoadFiles(distPath) {
  const indexPath = path.join(distPath, 'index.html');
  if (!fs.existsSync(indexPath)) {
    return [];
  }

  const htmlContent = fs.readFileSync(indexPath, 'utf-8');

  // 실제로 즉시 실행되는 script 태그만 (modulepreload 제외)
  const scriptMatches = htmlContent.matchAll(/<script[^>]*src=["']([^"']+)["'][^>]*>/g);

  // CSS 파일 (stylesheet link만)
  const stylesheetMatches = htmlContent.matchAll(/<link[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/g);

  const files = [];
  for (const match of scriptMatches) {
    if (match[1] && (match[1].endsWith('.js') || match[1].includes('assets/'))) {
      files.push(match[1]);
    }
  }
  for (const match of stylesheetMatches) {
    if (match[1] && (match[1].endsWith('.css') || match[1].includes('assets/'))) {
      files.push(match[1]);
    }
  }

  return files;
}

function checkBundleSize(buildDir) {
  // buildDir가 '.'이면 현재 디렉토리, 아니면 상대 경로로 처리
  const distPath = buildDir === '.'
    ? path.join(process.cwd(), 'dist')
    : path.join(process.cwd(), buildDir, 'dist');

  if (!fs.existsSync(distPath)) {
    console.warn(`⚠️  Build directory not found: ${distPath}`);
    return true;
  }

  // index.html에서 직접 로드되는 파일들 찾기
  const initialLoadFiles = getInitialLoadFiles(distPath);

  // 모든 JS/CSS 파일 찾기 (재귀적으로)
  const allFiles = getAllFiles(distPath);
  const jsCssFiles = allFiles.filter(file =>
    file.endsWith('.js') || file.endsWith('.css')
  );

  let totalSize = 0;
  const largeFiles = [];
  let initialLoadSize = 0;
  const initialLoadFilesList = [];

  // Initial Load Bundle 계산 (index.html에서 직접 로드되는 파일들)
  initialLoadFiles.forEach((relativePath) => {
    const filePath = path.join(distPath, relativePath.startsWith('/') ? relativePath.slice(1) : relativePath);
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      initialLoadSize += stats.size;
      initialLoadFilesList.push({
        name: relativePath,
        size: (stats.size / 1024).toFixed(2) + ' KB',
      });
    }
  });

  // 모든 파일 크기 계산
  jsCssFiles.forEach((filePath) => {
    const stats = fs.statSync(filePath);
    const relativePath = path.relative(distPath, filePath);
    totalSize += stats.size;

    if (stats.size > 100 * 1024) { // 100KB 이상 파일
      largeFiles.push({
        name: relativePath,
        size: (stats.size / 1024).toFixed(2) + ' KB',
      });
    }
  });

  const totalSizeKB = (totalSize / 1024).toFixed(2);
  const initialLoadSizeKB = initialLoadFiles.length > 0
    ? (initialLoadSize / 1024).toFixed(2)
    : 'N/A';
  const maxSizeKB = (MAX_BUNDLE_SIZE / 1024).toFixed(2);

  console.log(`\n📦 Bundle Size Check:`);
  console.log(`   Total JS/CSS: ${totalSizeKB} KB`);
  if (initialLoadFiles.length > 0) {
    console.log(`   Initial Load Bundle: ${initialLoadSizeKB} KB / ${maxSizeKB} KB`);
  }

  if (largeFiles.length > 0) {
    console.log(`\n   Large files (>100KB):`);
    largeFiles.forEach((file) => {
      console.log(`   - ${file.name}: ${file.size}`);
    });
  }

  if (initialLoadFiles.length > 0 && initialLoadSize > MAX_BUNDLE_SIZE) {
    console.error(`\n❌ Initial Load Bundle size exceeds limit!`);
    console.error(`   Current: ${initialLoadSizeKB} KB`);
    console.error(`   Limit: ${maxSizeKB} KB`);
    console.error(`   Over: ${((initialLoadSize - MAX_BUNDLE_SIZE) / 1024).toFixed(2)} KB`);
    if (initialLoadFilesList.length > 0) {
      console.error(`\n   Initial Load Files:`);
      initialLoadFilesList.forEach((file) => {
        console.error(`   - ${file.name}: ${file.size}`);
      });
    }
    process.exit(1);
  }

  console.log(`\n✅ Bundle size is within limit`);

  // React가 잘못된 청크에 포함되어 있는지 확인 (안전장치)
  // vendor-1, lib-* 청크에서 React 모듈 경로 확인
  const nonReactVendorFiles = jsCssFiles.filter(file => {
    const relativePath = path.relative(distPath, file);
    const fileName = path.basename(relativePath);
    // vendor-1, lib-* 청크는 있지만 react-vendor는 제외
    return (fileName.includes('vendor-1-') || 
            (fileName.startsWith('lib-') && !fileName.includes('react-vendor'))) &&
           relativePath.endsWith('.js');
  });

  if (nonReactVendorFiles.length > 0) {
    let hasReactInWrongChunk = false;
    
    nonReactVendorFiles.forEach((filePath) => {
      const content = fs.readFileSync(filePath, 'utf-8');
      const relativePath = path.relative(distPath, filePath);
      
      // 실제 React 모듈 경로가 포함되어 있는지 확인 (더 정확한 검사)
      const reactModulePatterns = [
        'node_modules/react/',
        'node_modules/react-dom/',
        'node_modules/react-is/',
        'node_modules/scheduler/',
        'node_modules/use-sync-external-store/'
      ];
      
      const hasReactModule = reactModulePatterns.some(pattern => content.includes(pattern));
      
      if (hasReactModule) {
        hasReactInWrongChunk = true;
        console.error(`\n❌ React module detected in non-React chunk!`);
        console.error(`   File: ${relativePath}`);
        console.error(`   This indicates React is not properly separated into react-vendor chunk.`);
        console.error(`   Please check vite.config.ts manualChunks configuration.`);
      }
    });
    
    if (hasReactInWrongChunk) {
      process.exit(1);
    }
  }

  return true;
}

// 실행
const buildDir = process.argv[2] || 'apps/academy-admin';
checkBundleSize(buildDir);

