type IconProps = { className?: string };

const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  viewBox: "0 0 24 24",
};

export const PhoneIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M6.6 3.5h2.1a1 1 0 0 1 .95.68l1.02 3.06a1 1 0 0 1-.25 1.02L8.9 9.78a12.5 12.5 0 0 0 5.32 5.32l1.52-1.52a1 1 0 0 1 1.02-.25l3.06 1.02a1 1 0 0 1 .68.95v2.1a2 2 0 0 1-2 2A15.5 15.5 0 0 1 4.6 5.5a2 2 0 0 1 2-2Z" />
  </svg>
);

export const HangUpIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M3.2 14.3c-.6-.6-.6-1.6.1-2.2C5.6 10 8.7 8.8 12 8.8s6.4 1.2 8.7 3.3c.7.6.7 1.6.1 2.2l-1.3 1.3a1 1 0 0 1-1.2.16l-2.3-1.2a1 1 0 0 1-.54-.9v-1.6a11 11 0 0 0-6.9 0v1.6a1 1 0 0 1-.54.9l-2.3 1.2a1 1 0 0 1-1.2-.16l-1.3-1.3Z" />
  </svg>
);

export const MicIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
  </svg>
);

export const MicOffIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M15 10.5V6a3 3 0 0 0-5.7-1.3M9 9v2a3 3 0 0 0 4.8 2.4M5.5 11a6.5 6.5 0 0 0 10.8 4.9M18.5 11c0 .6-.1 1.2-.2 1.7M12 17.5V21M4 4l16 16" />
  </svg>
);

export const KeyboardIcon =({ className }: IconProps) => (
  <svg {...base} className={className}>
    <rect x="3" y="6" width="18" height="12" rx="2.5" />
    <path d="M7 10h.01M10.5 10h.01M14 10h.01M17.5 10h.01M7 14h10" />
  </svg>
);

export const SpeakerIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4Z" />
    <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
  </svg>
);

export const SpeakerOffIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4Z" />
    <path d="m16 9.5 5 5M21 9.5l-5 5" />
  </svg>
);

export const ArrowUpIcon = ({ className }: IconProps) => (
  <svg {...base} strokeWidth={2.4} className={className}>
    <path d="M12 19V5M5.5 11.5 12 5l6.5 6.5" />
  </svg>
);

export const CheckIcon = ({ className }: IconProps) => (
  <svg {...base} strokeWidth={2.2} className={className}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);

export const PlusIcon = ({ className }: IconProps) => (
  <svg {...base} strokeWidth={2.2} className={className}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const RetryIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4v3.5H8" />
  </svg>
);

export const ArrowRightIcon = ({ className }: IconProps) => (
  <svg {...base} strokeWidth={2} className={className}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

export const ChevronIcon = ({ className }: IconProps) => (
  <svg {...base} strokeWidth={2} className={className}>
    <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />
  </svg>
);

export const PencilIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M4 20h4L19 9a2.83 2.83 0 0 0-4-4L4 16v4Z" />
  </svg>
);

export const MailIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
    <path d="m4.5 7.5 7.5 5.5 7.5-5.5" />
  </svg>
);

export const XLogoIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
    <path d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.66l-5.21-6.82-5.97 6.82H1.67l7.73-8.84L1.25 2.25h6.83l4.71 6.23 5.45-6.23Zm-1.16 17.52h1.83L7.08 4.13H5.12l11.96 15.64Z" />
  </svg>
);

export const ShieldIcon = ({ className }: IconProps) => (
  <svg {...base} strokeWidth={1.6} className={className}>
    <path d="M12 3.5 5 6.2v5.3c0 4.3 3 7.4 7 8.9 4-1.5 7-4.6 7-8.9V6.2L12 3.5Z" />
    <path d="m9 12.2 2.1 2.1 4-4.3" />
  </svg>
);

export const LockIcon = ({ className }: IconProps) => (
  <svg {...base} strokeWidth={1.6} className={className}>
    <rect x="5" y="10.5" width="14" height="10" rx="3" />
    <path d="M8.5 10.5V7.8a3.5 3.5 0 0 1 7 0v2.7" />
    <circle cx="12" cy="15.5" r="1" fill="currentColor" stroke="none" />
  </svg>
);

export const EyeOffIcon = ({ className }: IconProps) => (
  <svg {...base} strokeWidth={1.6} className={className}>
    <path d="M3.5 12s3.2-5.5 8.5-5.5S20.5 12 20.5 12s-3.2 5.5-8.5 5.5S3.5 12 3.5 12Z" />
    <circle cx="12" cy="12" r="2.6" />
    <path d="M4.5 4.5l15 15" />
  </svg>
);

export const TrashIcon = ({ className }: IconProps) => (
  <svg {...base} strokeWidth={1.6} className={className}>
    <path d="M5 6.5h14M9 6.5V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1.5M6.5 6.5l.9 12a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4l.9-12M10 10.5v6M14 10.5v6" />
  </svg>
);

export const BellIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 2h-15l1.5-2ZM10 20.5a2 2 0 0 0 4 0" />
  </svg>
);
