import type { ReactNode } from "react";

/**
 * Thin silver line icons used across the Home Screen. Stroke is
 * currentColor so each icon picks up the chrome/silver text tone of the
 * glass panel it sits in.
 */
function Icon({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className ?? "h-5 w-5"}
    >
      {children}
    </svg>
  );
}

export const IconPushPin = ({ className }: { className?: string }) => (
  <Icon className={className}>
    <path d="M9 3h6l-1 5 3.5 3.5H6.5L10 8 9 3Z" />
    <path d="M12 11.5V21" />
  </Icon>
);

export const IconMapPin = ({ className }: { className?: string }) => (
  <Icon className={className}>
    <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" />
    <circle cx="12" cy="10" r="2.5" />
  </Icon>
);

export const IconStorefront = ({ className }: { className?: string }) => (
  <Icon className={className}>
    <path d="M4 9h16v11H4z" />
    <path d="M3 9l1.5-5h15L21 9" />
    <path d="M3 9a2.4 2.4 0 0 0 4.5 0 2.4 2.4 0 0 0 4.5 0 2.4 2.4 0 0 0 4.5 0 2.4 2.4 0 0 0 4.5 0" />
    <path d="M9.5 20v-5h5v5" />
  </Icon>
);

export const IconHandshake = ({ className }: { className?: string }) => (
  <Icon className={className}>
    <path d="M3 12l3-4 4 1 2-1 2 1 4-1 3 4" />
    <path d="M8 13l2.5 2.5a1.6 1.6 0 0 0 2.3 0L16 12" />
    <path d="M16 12l3 3M5 12l3 3" />
  </Icon>
);

export const IconDots = ({ className }: { className?: string }) => (
  <Icon className={className}>
    <circle cx="5.5" cy="12" r="1.4" fill="currentColor" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" />
    <circle cx="18.5" cy="12" r="1.4" fill="currentColor" />
  </Icon>
);

export const IconSearch = ({ className }: { className?: string }) => (
  <Icon className={className}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M16 16l4.5 4.5" />
  </Icon>
);

export const IconGift = ({ className }: { className?: string }) => (
  <Icon className={className}>
    <path d="M3.5 11h17v9.5h-17z" />
    <path d="M2.5 7.5h19V11h-19z" />
    <path d="M12 7.5V21" />
    <path d="M12 7.5S10.5 3 8 3a2.2 2.2 0 0 0 0 4.5h4Zm0 0S13.5 3 16 3a2.2 2.2 0 0 1 0 4.5h-4Z" />
  </Icon>
);

export const IconLayers = ({ className }: { className?: string }) => (
  <Icon className={className}>
    <path d="M12 3 2.8 8 12 13l9.2-5L12 3Z" />
    <path d="M3 12.5 12 17.5l9-5" />
    <path d="M3 16.8 12 21.8l9-5" />
  </Icon>
);

export const IconPeople = ({ className }: { className?: string }) => (
  <Icon className={className}>
    <circle cx="9" cy="8" r="3" />
    <path d="M3 19c0-3.1 2.7-5 6-5s6 1.9 6 5" />
    <path d="M16 5.5a3 3 0 0 1 0 5.6" />
    <path d="M17 14.2c2.4.5 4 2.2 4 4.8" />
  </Icon>
);

export const IconCompass = ({ className }: { className?: string }) => (
  <Icon className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M15.5 8.5 13.6 13.6 8.5 15.5l1.9-5.1 5.1-1.9Z" />
  </Icon>
);

export const IconLeaf = ({ className }: { className?: string }) => (
  <Icon className={className}>
    <path d="M20 4c0 9-5.5 13-11 13a5 5 0 0 1 0-10c4 0 6-1 11-3Z" />
    <path d="M4 20c3-6 7-9 12-11" />
  </Icon>
);

export const IconBasket = ({ className }: { className?: string }) => (
  <Icon className={className}>
    <path d="M3 9h18l-1.6 9.4a2 2 0 0 1-2 1.6H6.6a2 2 0 0 1-2-1.6L3 9Z" />
    <path d="M8 9 10.5 4M16 9 13.5 4" />
  </Icon>
);

export const IconBag = ({ className }: { className?: string }) => (
  <Icon className={className}>
    <path d="M5 8h14l1 12H4L5 8Z" />
    <path d="M9 8V6a3 3 0 0 1 6 0v2" />
  </Icon>
);

export const IconUtensils = ({ className }: { className?: string }) => (
  <Icon className={className}>
    <path d="M7 3v7a2 2 0 0 0 4 0V3" />
    <path d="M9 10v11M17 3c-1.6 1.2-2.5 3-2.5 5.5S15.4 12 17 12v9" />
  </Icon>
);

export const IconShare = ({ className }: { className?: string }) => (
  <Icon className={className}>
    <path d="M14 3h7v7" />
    <path d="M21 3 11 13" />
    <path d="M20 14v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5" />
  </Icon>
);

export const IconChat = ({ className }: { className?: string }) => (
  <Icon className={className}>
    <path d="M20.5 12c0 4-3.8 7-8.5 7a10 10 0 0 1-2.8-.4L4 20l1.3-3.4A6.7 6.7 0 0 1 3.5 12c0-4 3.8-7 8.5-7s8.5 3 8.5 7Z" />
    <path d="M8.5 12h.01M12 12h.01M15.5 12h.01" />
  </Icon>
);

export const IconAlert = ({ className }: { className?: string }) => (
  <Icon className={className}>
    <path d="M12 4 2.8 19.5h18.4L12 4Z" />
    <path d="M12 10v4.2M12 17.2h.01" />
  </Icon>
);

export const IconBriefcase = ({ className }: { className?: string }) => (
  <Icon className={className}>
    <path d="M3 8h18v12H3z" />
    <path d="M9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    <path d="M3 13h18" />
  </Icon>
);

export const IconChevron = ({ className }: { className?: string }) => (
  <Icon className={className}>
    <path d="m7 10 5 5 5-5" />
  </Icon>
);

export const IconArrowRight = ({ className }: { className?: string }) => (
  <Icon className={className}>
    <path d="M4 12h15" />
    <path d="m13 6 6 6-6 6" />
  </Icon>
);

export const IconSparkle = ({ className }: { className?: string }) => (
  <Icon className={className}>
    <path d="M12 3.5 13.8 9 19.5 10.8 13.8 12.6 12 18.2 10.2 12.6 4.5 10.8 10.2 9 12 3.5Z" />
  </Icon>
);

export const IconCalendar = ({ className }: { className?: string }) => (
  <Icon className={className}>
    <path d="M4 6h16v15H4z" />
    <path d="M8 3v5M16 3v5M4 11h16" />
  </Icon>
);

export const IconUser = ({ className }: { className?: string }) => (
  <Icon className={className}>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M4.5 20c0-3.8 3.4-6 7.5-6s7.5 2.2 7.5 6" />
  </Icon>
);

export const IconInfo = ({ className }: { className?: string }) => (
  <Icon className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5.5M12 7.8h.01" />
  </Icon>
);

export const IconTag = ({ className }: { className?: string }) => (
  <Icon className={className}>
    <path d="M3 12.5V4h8.5l8.5 8.5-8.5 8.5L3 12.5Z" />
    <circle cx="7.5" cy="8.5" r="1.3" />
  </Icon>
);

export const IconLifeRing = ({ className }: { className?: string }) => (
  <Icon className={className}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="3.6" />
    <path d="m5.7 5.7 3.8 3.8M18.3 5.7l-3.8 3.8M5.7 18.3l3.8-3.8M18.3 18.3l-3.8-3.8" />
  </Icon>
);

export const IconPhone = ({ className }: { className?: string }) => (
  <Icon className={className}>
    <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
    <path d="M10.5 5.5h3" />
  </Icon>
);

export const IconPlus = ({ className }: { className?: string }) => (
  <Icon className={className}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);
