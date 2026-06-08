import { dark } from "@clerk/themes";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

// Branded Clerk appearance — dark emerald "glass" card matching the
// OpyPal by Divini Group theme: deep emerald (#0B2A20), gold (#C9A24B),
// cream text (#F7F4EC), Outfit display font. Sits on the emerald AuthShell,
// echoing the glassy feature cards on the landing page.
export const clerkAppearance = {
  theme: dark,
  cssLayerName: "clerk",
  options: {
    // The AuthShell already shows the Divini logo + wordmark above the card,
    // so the in-card logo is hidden to avoid duplication.
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/divini-logo-white.png`,
  },
  variables: {
    colorPrimary: "#C9A24B",
    colorBackground: "transparent",
    colorForeground: "#F7F4EC",
    colorMutedForeground: "#A9B8AF",
    colorInput: "rgba(255, 255, 255, 0.05)",
    colorInputForeground: "#F7F4EC",
    colorNeutral: "#F7F4EC",
    colorDanger: "hsl(0 84% 66%)",
    colorSuccess: "hsl(150 55% 55%)",
    fontFamily: "'Outfit', 'Inter', system-ui, sans-serif",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox:
      "w-[440px] max-w-full overflow-hidden rounded-2xl border border-[#C9A24B]/25 bg-[#0E3327]/80 shadow-2xl shadow-black/40 backdrop-blur-xl",
    card: "!bg-transparent !shadow-none !border-0 !rounded-none",
    footer: "!bg-transparent !shadow-none !border-0 !rounded-none",
    // AuthShell already renders the brand logo above the card.
    logoBox: "hidden",
    headerTitle: "text-[#F7F4EC] font-semibold",
    headerSubtitle: "text-[#F7F4EC]/60",
    socialButtonsBlockButton:
      "border border-white/15 bg-white/[0.04] text-[#F7F4EC] hover:bg-white/[0.08]",
    socialButtonsBlockButtonText: "text-[#F7F4EC]",
    dividerText: "text-[#F7F4EC]/40",
    dividerLine: "bg-white/15",
    formFieldLabel: "text-[#F7F4EC]/80",
    formFieldInput:
      "bg-white/[0.05] border border-white/15 text-[#F7F4EC] placeholder:text-[#F7F4EC]/40 focus:border-[#C9A24B]/60",
    formButtonPrimary:
      "bg-[#C9A24B] text-[#0B2A20] font-semibold shadow-lg shadow-[#C9A24B]/20 hover:bg-[#d8b566]",
    footerActionText: "text-[#F7F4EC]/60",
    footerActionLink: "text-[#C9A24B] font-medium hover:text-[#d8b566]",
    footerAction: "",
    identityPreviewText: "text-[#F7F4EC]",
    identityPreviewEditButton: "text-[#C9A24B] hover:text-[#d8b566]",
    formFieldSuccessText: "text-green-400",
    formFieldErrorText: "text-red-300",
    formFieldAction: "text-[#C9A24B] hover:text-[#d8b566]",
    formResendCodeLink: "text-[#C9A24B] hover:text-[#d8b566]",
    otpCodeFieldInput: "text-[#F7F4EC] border-white/15",
    alertText: "text-[#F7F4EC]/80",
    userPreviewMainIdentifier: "text-[#F7F4EC]",
    userPreviewSecondaryIdentifier: "text-[#F7F4EC]/60",
  },
};
