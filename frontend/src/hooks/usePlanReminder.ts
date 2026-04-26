import { useCallback, useEffect, useState } from "react";

const PLAN_REMINDER_ENABLED_KEY = "poetry_ai_plan_reminder_enabled";
const PLAN_REMINDER_LAST_NOTIFY_KEY = "poetry_ai_plan_reminder_last_notify_at";
const PLAN_REMINDER_NOTIFY_INTERVAL_MS = 2 * 60 * 60 * 1000;

export function usePlanReminder(plan: unknown | null, pendingCount: number) {
  const reminderSupported = typeof window !== "undefined" && "Notification" in window;

  const [planReminderEnabled, setPlanReminderEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(PLAN_REMINDER_ENABLED_KEY) === "1";
  });
  const [planReminderPermission, setPlanReminderPermission] = useState<NotificationPermission>(
    () => (reminderSupported ? Notification.permission : "default"),
  );
  const [planReminderMessage, setPlanReminderMessage] = useState<string>("");

  useEffect(() => {
    if (reminderSupported && Notification.permission !== planReminderPermission) {
      setPlanReminderPermission(Notification.permission);
    }
  }, [planReminderPermission, reminderSupported]);

  const requestPlanReminderPermission = useCallback(async (): Promise<NotificationPermission | null> => {
    if (!reminderSupported) {
      setPlanReminderMessage("当前浏览器不支持通知提醒。");
      return null;
    }
    const permission = await Notification.requestPermission();
    setPlanReminderPermission(permission);
    return permission;
  }, [reminderSupported]);

  const togglePlanReminder = useCallback(async (): Promise<void> => {
    if (!planReminderEnabled) {
      const permission = planReminderPermission === "granted" ? "granted" : await requestPlanReminderPermission();
      if (permission !== "granted") {
        setPlanReminderMessage("未获得通知权限，请在浏览器中允许通知。");
        return;
      }
      setPlanReminderEnabled(true);
      window.localStorage.setItem(PLAN_REMINDER_ENABLED_KEY, "1");
      setPlanReminderMessage("复习提醒已开启。");
      return;
    }

    setPlanReminderEnabled(false);
    window.localStorage.setItem(PLAN_REMINDER_ENABLED_KEY, "0");
    setPlanReminderMessage("复习提醒已关闭。");
  }, [planReminderEnabled, planReminderPermission, requestPlanReminderPermission]);

  const sendPlanReminderTest = useCallback(async (): Promise<void> => {
    if (!reminderSupported) {
      setPlanReminderMessage("当前浏览器不支持通知提醒。");
      return;
    }
    const permission = planReminderPermission === "granted" ? "granted" : await requestPlanReminderPermission();
    if (permission !== "granted") {
      setPlanReminderMessage("通知权限未开启，无法发送测试提醒。");
      return;
    }
    new Notification("诗境通复习提醒", {
      body: "这是测试提醒：你可以按计划完成今天的复习任务。",
      tag: "poetry-ai-plan-reminder-test",
    });
    setPlanReminderMessage("测试提醒已发送。");
  }, [planReminderPermission, reminderSupported, requestPlanReminderPermission]);

  // Auto-reminder effect
  useEffect(() => {
    if (!reminderSupported || !planReminderEnabled || planReminderPermission !== "granted") {
      return;
    }
    if (!plan || pendingCount <= 0) {
      return;
    }

    const now = Date.now();
    const lastNotifyAt = Number(window.localStorage.getItem(PLAN_REMINDER_LAST_NOTIFY_KEY) || "0");
    if (Number.isFinite(lastNotifyAt) && now - lastNotifyAt < PLAN_REMINDER_NOTIFY_INTERVAL_MS) {
      return;
    }

    const title = "诗境通复习提醒";
    const body = `当前还有 ${pendingCount} 项任务未完成，建议先处理高优先任务。`;
    new Notification(title, { body, tag: "poetry-ai-plan-reminder" });
    window.localStorage.setItem(PLAN_REMINDER_LAST_NOTIFY_KEY, String(now));
  }, [plan, pendingCount, planReminderEnabled, planReminderPermission, reminderSupported]);

  return {
    reminderSupported,
    planReminderEnabled,
    planReminderPermission,
    planReminderMessage,
    setPlanReminderMessage,
    requestPlanReminderPermission,
    togglePlanReminder,
    sendPlanReminderTest,
  };
}
