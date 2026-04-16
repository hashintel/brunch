import { cn } from '@/client/lib/utils';

/**
 * HASH rainbow gradient mark — extracted from hash-frontend's HashIcon.
 * The `#` symbol rendered with blue-purple gradient fills.
 */
export function HashMark({ className }: { className?: string }) {
  return (
    <svg
      className={cn('size-5', className)}
      viewBox="0 0 22 22"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g opacity="0.9">
        <path opacity="0.886" d="M12.147 22h6.032V0h-6.032v22Z" fill="url(#hm_a)" />
        <path opacity="0.898" d="M3.486 22h6.032V0H3.486v22Z" fill="url(#hm_b)" />
        <path opacity="0.881" d="M0 9.43h21.665V3.304H0V9.43Z" fill="url(#hm_c)" />
        <path opacity="0.856" d="M0 18.382h21.665v-6.126H0v6.126Z" fill="url(#hm_d)" />
      </g>
      <defs>
        <linearGradient id="hm_a" x1="18.179" y1="22" x2="18.179" y2="0" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00BBFF" />
          <stop offset="1" stopColor="#0046FF" />
        </linearGradient>
        <linearGradient id="hm_b" x1="3.486" y1="0" x2="3.486" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00B8FF" />
          <stop offset="1" stopColor="#0010FF" />
        </linearGradient>
        <linearGradient id="hm_c" x1="1.269" y1="9.125" x2="20.783" y2="9.125" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00AFFF" />
          <stop offset="1" stopColor="#5424FF" />
        </linearGradient>
        <linearGradient
          id="hm_d"
          x1="1.907"
          y1="18.112"
          x2="21.665"
          y2="18.112"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#6D2BF6" />
          <stop offset="1" stopColor="#0080FF" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/**
 * "HASH" wordmark — extracted from hash-frontend's HashIcon.
 * Dark text, works on light backgrounds.
 */
export function HashWordmark({ className }: { className?: string }) {
  return (
    <svg className={cn('h-4', className)} viewBox="30 0 90 22" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M30.18.657h5.614v7.742h7.205V.657h5.613v20.686h-5.613v-7.861h-7.205v7.861H30.18V.657Z"
        fill="currentColor"
        fillOpacity="0.95"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M66.929.657h-5.422L52.867 21.413h5.915l1.45-3.68h7.828l1.479 3.68h6.03L66.929.657Zm-2.755 6.771 2.262 5.86h-4.552l2.29-5.86Z"
        fill="currentColor"
        fillOpacity="0.95"
      />
      <path
        d="M87.801 21.343c-1.824 0-3.556-.276-5.196-.829-1.64-.552-3.09-1.38-4.352-2.486l3.144-3.685c2.037 1.6 4.24 2.4 6.607 2.4.757 0 1.334-.12 1.732-.357.398-.238.597-.576.597-1.015v-.057c0-.21-.048-.395-.145-.557a1.396 1.396 0 0 0-.539-.471 4.76 4.76 0 0 0-1.048-.443 18.98 18.98 0 0 0-1.703-.443c-1.087-.248-2.096-.519-3.028-.814a7.622 7.622 0 0 1-2.43-1.143 4.893 4.893 0 0 1-1.63-1.743c-.398-.695-.597-1.557-.597-2.586v-.057c0-.933.18-1.79.539-2.571a5.828 5.828 0 0 1 1.572-2.029 7.234 7.234 0 0 1 2.489-1.328A10.157 10.157 0 0 1 87.103.657c1.746 0 3.303.224 4.671.671 1.368.448 2.605 1.11 3.712 1.986l-2.824 3.914a12.348 12.348 0 0 0-2.867-1.471 8.473 8.473 0 0 0-2.838-.5c-.68 0-1.189.124-1.528.372-.34.247-.51.552-.51.914v.057c0 .229.054.429.16.6.107.172.291.329.553.471.262.143.612.286 1.068.429.456.143 1.033.29 1.732.443 1.164.247 2.217.538 3.158.871a7.18 7.18 0 0 1 2.402 1.214c.66.476 1.164 1.052 1.514 1.729.35.676.524 1.48.524 2.414v.057c0 1.029-.199 1.943-.597 2.743a5.707 5.707 0 0 1-1.674 2.043 7.387 7.387 0 0 1-2.59 1.286 10.955 10.955 0 0 1-3.377.443Z"
        fill="currentColor"
        fillOpacity="0.95"
      />
      <path
        d="M100.997.657h5.613v7.742h7.205V.657h5.614v20.686h-5.614v-7.861h-7.205v7.861h-5.613V.657Z"
        fill="currentColor"
        fillOpacity="0.95"
      />
    </svg>
  );
}
