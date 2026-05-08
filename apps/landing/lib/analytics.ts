type EventName =
  | "landing_page_viewed"
  | "hero_animation_completed"
  | "section_in_view"
  | "install_button_clicked"
  | "qr_modal_opened"
  | "waitlist_sheet_opened"
  | "waitlist_submitted"
  | "faq_opened"
  | "install_page_viewed"
  | "apk_download_triggered"
  | "install_network_slow_warning_shown";

type Props = Record<string, string | number | boolean | undefined | null>;

type PostHog = { capture: (name: string, props?: Props) => void };
declare global {
  interface Window {
    posthog?: PostHog;
  }
}

export function track(name: EventName, props?: Props) {
  try {
    if (typeof window !== "undefined" && window.posthog) {
      window.posthog.capture(name, props);
    } else if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.debug("[analytics]", name, props ?? {});
    }
  } catch {
    /* swallow — analytics never breaks UX */
  }
}
