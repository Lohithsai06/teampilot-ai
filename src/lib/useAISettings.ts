"use client";

import { useState, useEffect } from "react";
import { doc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

export interface AISettings {
  geminiApiKey: string;
  openRouterApiKey: string;
  preferredProvider: "gemini" | "openrouter" | "none";
  fallbackProvider: "gemini" | "openrouter" | "none";
  enableFallback: boolean;
}

const DEFAULT_SETTINGS: AISettings = {
  geminiApiKey: "",
  openRouterApiKey: "",
  preferredProvider: "none",
  fallbackProvider: "none",
  enableFallback: true,
};

export function useAISettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<AISettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Real-time listener on users/{uid}.aiSettings sub-field
  useEffect(() => {
    if (!user) {
      setSettings(DEFAULT_SETTINGS);
      setLoading(false);
      return;
    }

    const ref = doc(db, "users", user.uid);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setSettings({
          geminiApiKey: data.geminiApiKey ?? "",
          openRouterApiKey: data.openRouterApiKey ?? "",
          preferredProvider: data.preferredProvider ?? "none",
          fallbackProvider: data.fallbackProvider ?? "none",
          enableFallback: data.enableFallback ?? true,
        });
      }
      setLoading(false);
    });

    return () => unsub();
  }, [user]);

  const saveSettings = async (updated: Partial<AISettings>) => {
    if (!user) return;
    setSaving(true);
    try {
      await setDoc(
        doc(db, "users", user.uid),
        { ...updated, updatedAt: serverTimestamp() },
        { merge: true }
      );
    } finally {
      setSaving(false);
    }
  };

  // Derived: which providers are actually configured
  const geminiConfigured = !!settings.geminiApiKey;
  const openRouterConfigured = !!settings.openRouterApiKey;
  const anyProviderConfigured = geminiConfigured || openRouterConfigured;

  // The active provider to use
  const activeProvider: "gemini" | "openrouter" | null = (() => {
    if (settings.preferredProvider === "gemini" && geminiConfigured) return "gemini";
    if (settings.preferredProvider === "openrouter" && openRouterConfigured) return "openrouter";
    if (geminiConfigured) return "gemini";
    if (openRouterConfigured) return "openrouter";
    return null;
  })();

  return {
    settings,
    loading,
    saving,
    saveSettings,
    geminiConfigured,
    openRouterConfigured,
    anyProviderConfigured,
    activeProvider,
  };
}
