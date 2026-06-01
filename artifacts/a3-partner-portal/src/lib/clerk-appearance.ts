import { shadcn } from "@clerk/themes";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

// Branded Clerk appearance matching the Opypal navy/gold theme and Outfit font.
export const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "hsl(215 79% 28%)",
    colorForeground: "hsl(215 79% 10%)",
    colorMutedForeground: "hsl(215 20% 46%)",
    colorDanger: "hsl(0 84% 60%)",
    colorBackground: "hsl(0 0% 100%)",
    colorInput: "hsl(0 0% 100%)",
    colorInputForeground: "hsl(215 79% 10%)",
    colorNeutral: "hsl(220 13% 91%)",
    fontFamily: "'Outfit', 'Inter', system-ui, sans-serif",
    borderRadius: "0.5rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox:
      "bg-white rounded-2xl w-[440px] max-w-full overflow-hidden shadow-xl border border-gray-200",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-gray-900 font-semibold",
    headerSubtitle: "text-gray-500",
    socialButtonsBlockButtonText: "text-gray-700",
    formFieldLabel: "text-gray-700",
    footerActionLink: "text-[hsl(215_79%_28%)] font-medium",
    footerActionText: "text-gray-500",
    dividerText: "text-gray-400",
    identityPreviewEditButton: "text-[hsl(215_79%_28%)]",
    formFieldSuccessText: "text-green-600",
    alertText: "text-gray-700",
    logoBox: "justify-center",
    logoImage: "h-10",
    socialButtonsBlockButton: "border border-gray-200 hover:bg-gray-50",
    formButtonPrimary:
      "bg-[hsl(215_79%_28%)] hover:bg-[hsl(215_79%_24%)] text-white",
    formFieldInput: "bg-white border border-gray-200 text-gray-900",
    footerAction: "",
    dividerLine: "bg-gray-200",
    alert: "",
    otpCodeFieldInput: "text-gray-900",
    formFieldRow: "",
    main: "",
  },
};
