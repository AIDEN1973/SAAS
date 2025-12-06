/**
 * Bundle Size Checker
 * 
 * [불변 규칙] Initial Load Bundle ≤ 500KB (초과 시 빌드 실패)
 */

const fs = require('fs');
const path = require('path');

const MAX_BUNDLE_SIZE = 500 * 1024; // 500KB

function checkBundleSize(buildDir) {
  const distPath = path.join(process.cwd(), buildDir, 'dist');
  
  if (!fs.existsSync(distPath)) {
    console.warn(`⚠️  Build directory not found: ${distPath}`);
    return true;
  }

  const files = fs.readdirSync(distPath);
  let totalSize = 0;
  const largeFiles = [];

  files.forEach((file) => {
    const filePath = path.join(distPath, file);
    const stats = fs.statSync(filePath);
    
    if (stats.isFile() && (file.endsWith('.js') || file.endsWith('.css'))) {
      totalSize += stats.size;
      
      if (stats.size > 100 * 1024) { // 100KB 이상 파일
        largeFiles.push({
          name: file,
          size: (stats.size / 1024).toFixed(2) + ' KB',
        });
      }
    }
  });

  const totalSizeKB = (totalSize / 1024).toFixed(2);
  const maxSizeKB = (MAX_BUNDLE_SIZE / 1024).toFixed(2);

  console.log(`\n📦 Bundle Size Check:`);
  console.log(`   Total: ${totalSizeKB} KB / ${maxSizeKB} KB`);

  if (largeFiles.length > 0) {
    console.log(`\n   Large files:`);
    largeFiles.forEach((file) => {
      console.log(`   - ${file.name}: ${file.size}`);
    });
  }

  if (totalSize > MAX_BUNDLE_SIZE) {
    console.error(`\n❌ Bundle size exceeds limit!`);
    console.error(`   Current: ${totalSizeKB} KB`);
    console.error(`   Limit: ${maxSizeKB} KB`);
    console.error(`   Over: ${((totalSize - MAX_BUNDLE_SIZE) / 1024).toFixed(2)} KB`);
    process.exit(1);
  }

  console.log(`\n✅ Bundle size is within limit`);
  return true;
}

// 실행
const buildDir = process.argv[2] || 'apps/academy-admin';
checkBundleSize(buildDir);

