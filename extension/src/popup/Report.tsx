/**
 * Report.tsx — 담당: 수연
 *
 * Chart.js로 사용자 시청/피드백 통계를 시각화한다.
 */

import { useEffect, useRef, useState } from "react";
import Chart from "chart.js/auto";
import { ReportStats } from "../types";

interface ReportProps {
  onBack: () => void;
}

const FEEDBACK_LABELS: Record<string, string> = {
  like: "좋아요",
  dislike: "싫어요",
  skip: "스킵",
  click: "클릭",
};

export function Report({ onBack }: ReportProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart | null>(null);
  const [stats, setStats] = useState<ReportStats | null>(null);

  useEffect(() => {
    chrome.runtime.sendMessage({ type: "GET_REPORT_STATS" }).then((res) => {
      if (res?.type === "REPORT_STATS") {
        setStats(res.payload);
      }
    });
  }, []);

  useEffect(() => {
    if (!stats || !canvasRef.current) return;

    chartRef.current?.destroy();
    chartRef.current = new Chart(canvasRef.current, {
      type: "bar",
      data: {
        labels: Object.keys(stats.byType).map((key) => FEEDBACK_LABELS[key] ?? key),
        datasets: [
          {
            label: "피드백 횟수",
            data: Object.values(stats.byType),
            backgroundColor: "#4f46e5",
          },
        ],
      },
      options: {
        responsive: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
      },
    });

    return () => chartRef.current?.destroy();
  }, [stats]);

  return (
    <div style={{ width: 320, padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <button
        onClick={onBack}
        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, marginBottom: 8 }}
      >
        ← 뒤로
      </button>
      <h1 style={{ fontSize: 16, marginBottom: 12 }}>내 시청 리포트</h1>

      {!stats && <p style={{ fontSize: 13, color: "#888" }}>불러오는 중...</p>}

      {stats && (
        <>
          <p style={{ fontSize: 12, color: "#555", marginBottom: 8 }}>
            총 {stats.totalEvents}개의 피드백이 기록되었습니다.
          </p>
          <canvas ref={canvasRef} width={288} height={180} />

          <h2 style={{ fontSize: 13, marginTop: 16, marginBottom: 6 }}>선호 키워드 Top 10</h2>
          {stats.topKeywords.length === 0 && (
            <p style={{ fontSize: 12, color: "#888" }}>아직 데이터가 충분하지 않습니다.</p>
          )}
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {stats.topKeywords.map(({ keyword, score }) => (
              <li
                key={keyword}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 12,
                  padding: "3px 0",
                  borderBottom: "1px solid #eee",
                }}
              >
                <span>{keyword}</span>
                <span style={{ color: score >= 0 ? "#16a34a" : "#dc2626" }}>
                  {score.toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
