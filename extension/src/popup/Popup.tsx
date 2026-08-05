/**
 * Popup.tsx — 담당: 수연
 *
 * 자연어 입력창, 카테고리 선택, 다양성 슬라이더 UI.
 * Report 화면으로 이동하는 탭을 포함한다.
 */

import { useEffect, useState } from "react";
import { PreferenceProfile, RuntimeMessage } from "../types";

const CATEGORY_OPTIONS = ["교육", "코딩", "영어", "운동", "음악", "게임", "뉴스", "요리"];

interface PopupProps {
  onNavigateToReport: () => void;
}

export function Popup({ onNavigateToReport }: PopupProps) {
  const [naturalLanguageInput, setNaturalLanguageInput] = useState("");
  const [allowCategories, setAllowCategories] = useState<string[]>([]);
  const [diversity, setDiversity] = useState(0.5);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [profile, setProfile] = useState<PreferenceProfile | null>(null);

  useEffect(() => {
    chrome.runtime.sendMessage({ type: "GET_PREFERENCE_PROFILE" }).then((res) => {
      if (res) {
        setProfile(res);
        setAllowCategories(res.allow_category ?? []);
        setDiversity(res.diversity_level ?? 0.5);
      }
    });
  }, []);

  function toggleCategory(category: string) {
    setAllowCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]
    );
  }

  async function handleSubmit() {
    if (naturalLanguageInput.trim().length === 0) return;
    setStatus("loading");
    const message: RuntimeMessage = {
      type: "REQUEST_PREFERENCE_PROFILE",
      payload: { text: naturalLanguageInput },
    };
    const response = await chrome.runtime.sendMessage(message);
    if (response?.type === "PREFERENCE_PROFILE_UPDATED") {
      setProfile(response.payload);
      setStatus("idle");
    } else {
      setStatus("error");
    }
  }

  return (
    <div style={{ width: 320, padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 18, marginBottom: 8 }}>umalgoritm</h1>

      <label style={{ fontSize: 13, color: "#555" }}>어떤 영상을 보고 싶나요?</label>
      <textarea
        value={naturalLanguageInput}
        onChange={(e) => setNaturalLanguageInput(e.target.value)}
        placeholder="예: 영어 공부 위주, 쇼츠 제외, 가끔 새로운 것도 보여줘"
        rows={3}
        style={{ width: "100%", marginTop: 4, marginBottom: 12, padding: 8, boxSizing: "border-box" }}
      />

      <div style={{ marginBottom: 12 }}>
        <span style={{ fontSize: 13, color: "#555" }}>선호 카테고리</span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
          {CATEGORY_OPTIONS.map((category) => (
            <button
              key={category}
              onClick={() => toggleCategory(category)}
              style={{
                padding: "4px 10px",
                borderRadius: 999,
                border: "1px solid #ccc",
                background: allowCategories.includes(category) ? "#4f46e5" : "#fff",
                color: allowCategories.includes(category) ? "#fff" : "#333",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 13, color: "#555" }}>
          다양성 {Math.round(diversity * 100)}%
        </label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={diversity}
          onChange={(e) => setDiversity(Number(e.target.value))}
          style={{ width: "100%" }}
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={status === "loading"}
        style={{
          width: "100%",
          padding: 10,
          background: "#4f46e5",
          color: "#fff",
          border: "none",
          borderRadius: 6,
          cursor: "pointer",
          marginBottom: 8,
        }}
      >
        {status === "loading" ? "적용 중..." : "적용하기"}
      </button>

      {status === "error" && (
        <p style={{ color: "#dc2626", fontSize: 12 }}>
          프로필을 업데이트하지 못했습니다. 백엔드 서버 연결을 확인해주세요.
        </p>
      )}

      {profile && status !== "loading" && (
        <p style={{ fontSize: 11, color: "#888" }}>
          현재 프로필: 허용 {profile.allow_category.length}개 · 차단 {profile.block_category.length}개
        </p>
      )}

      <button
        onClick={onNavigateToReport}
        style={{
          width: "100%",
          padding: 8,
          marginTop: 8,
          background: "transparent",
          border: "1px solid #ccc",
          borderRadius: 6,
          cursor: "pointer",
          fontSize: 13,
        }}
      >
        내 시청 리포트 보기 →
      </button>
    </div>
  );
}
