/**
 * PDF 생성 유틸리티
 *
 * [LAYER: UI_UTILS]
 * [불변 규칙] jsPDF 라이브러리 사용
 * [요구사항] 통계문서 FR-09: 월간 리포트 PDF 다운로드
 *
 * Purpose: Analytics 페이지의 월간 리포트를 PDF로 생성
 */

import jsPDF from 'jspdf';
// eslint-disable-next-line import/no-named-as-default
import autoTable from 'jspdf-autotable';

// jsPDF with autoTable plugin augmentation
interface jsPDFWithAutoTable extends jsPDF {
  lastAutoTable: {
    finalY: number;
  };
}

export interface MonthlyReportData {
  /** 학원 이름 */
  academyName: string;
  /** 보고서 생성 월 (YYYY-MM) */
  reportMonth: string;
  /** 지역 정보 */
  region: string;
  /** 주요 지표 */
  metrics: {
    students: number;
    revenue: number;
    attendance: number;
    growth: number;
  };
  /** 지역 비교 통계 */
  regionalStats: {
    metric: string;
    value: number;
    rank: number;
    percentile: number;
    average: number;
    top10Percent: number;
    comparisonGroup: string;
  }[];
  /** AI 인사이트 */
  aiInsights?: string[];
}

/**
 * 월간 리포트 PDF 생성
 *
 * @param data 리포트 데이터
 * @returns PDF Blob
 */
export function generateMonthlyReportPDF(data: MonthlyReportData): Blob {
  // A4 사이즈, 세로 방향
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // 한글 폰트 설정이 없으면 한글이 깨지므로, 기본 폰트 사용
  // TODO: 한글 폰트 임베드 필요 (Noto Sans KR 등)

  let yPosition = 20;

  // 1. 제목
  doc.setFontSize(18);
  doc.text('월간 통계 리포트', 105, yPosition, { align: 'center' });
  yPosition += 10;

  // 2. 기본 정보
  doc.setFontSize(12);
  doc.text(`Academy: ${data.academyName}`, 20, yPosition);
  yPosition += 7;
  doc.text(`Report Month: ${data.reportMonth}`, 20, yPosition);
  yPosition += 7;
  doc.text(`Location: ${data.region}`, 20, yPosition);
  yPosition += 10;

  // 3. 주요 지표 테이블
  doc.setFontSize(14);
  doc.text('Key Metrics', 20, yPosition);
  yPosition += 5;

  autoTable(doc, {
    startY: yPosition,
    head: [['Metric', 'Value']],
    body: [
      ['Students', data.metrics.students.toString()],
      ['Revenue (KRW)', data.metrics.revenue.toLocaleString('ko-KR')],
      ['Attendance Rate (%)', data.metrics.attendance.toString()],
      ['Growth Rate (%)', data.metrics.growth.toString()],
    ],
    theme: 'grid',
    headStyles: { fillColor: [66, 139, 202] },
    margin: { left: 20 },
  });

  yPosition = (doc as jsPDFWithAutoTable).lastAutoTable.finalY + 10;

  // 4. 지역 비교 통계 테이블
  if (data.regionalStats.length > 0) {
    doc.setFontSize(14);
    doc.text('Regional Comparison', 20, yPosition);
    yPosition += 5;

    autoTable(doc, {
      startY: yPosition,
      head: [['Metric', 'Value', 'Rank', 'Percentile', 'Average', 'Top 10%', 'Comparison Group']],
      body: data.regionalStats.map(stat => [
        stat.metric,
        stat.value.toString(),
        stat.rank.toString(),
        `${stat.percentile.toFixed(1)}%`,
        stat.average.toFixed(1),
        stat.top10Percent.toFixed(1),
        stat.comparisonGroup,
      ]),
      theme: 'striped',
      headStyles: { fillColor: [66, 139, 202] },
      margin: { left: 20 },
    });

    yPosition = (doc as jsPDFWithAutoTable).lastAutoTable.finalY + 10;
  }

  // 5. AI 인사이트
  if (data.aiInsights && data.aiInsights.length > 0) {
    doc.setFontSize(14);
    doc.text('AI Insights', 20, yPosition);
    yPosition += 7;

    doc.setFontSize(10);
    data.aiInsights.forEach((insight, index) => {
      const lines = doc.splitTextToSize(`${index + 1}. ${insight}`, 170) as string | string[];
      const linesArray = Array.isArray(lines) ? lines : [lines];
      doc.text(linesArray, 20, yPosition);
      yPosition += linesArray.length * 5 + 3;

      // 페이지 넘김 처리
      if (yPosition > 270) {
        doc.addPage();
        yPosition = 20;
      }
    });
  }

  // 6. 생성 일시
  yPosition += 10;
  if (yPosition > 270) {
    doc.addPage();
    yPosition = 20;
  }
  doc.setFontSize(8);
  doc.text(`Generated: ${new Date().toLocaleString('ko-KR')}`, 20, yPosition);

  // Blob 반환
  return doc.output('blob');
}

/**
 * PDF 다운로드 트리거
 *
 * @param data 리포트 데이터
 * @param filename 파일명 (기본: monthly-report-YYYY-MM.pdf)
 */
export function downloadMonthlyReportPDF(data: MonthlyReportData, filename?: string): void {
  const blob = generateMonthlyReportPDF(data);
  const defaultFilename = `monthly-report-${data.reportMonth}.pdf`;
  const finalFilename = filename || defaultFilename;

  // Blob을 다운로드
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = finalFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
