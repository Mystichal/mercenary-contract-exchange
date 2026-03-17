/**
 * Custom dapp-kit theme matching CCP Design System.
 * Passed to <WalletProvider theme={walletTheme}>.
 */
export const walletTheme = {
  blurs: {
    modalOverlay: "blur(4px)",
  },
  backgroundColors: {
    primaryButton: "#FF4700",
    primaryButtonHover: "#E03F00",
    outlineButtonHover: "rgba(250, 250, 229, 0.04)",
    modalOverlay: "rgba(0, 0, 0, 0.82)",
    modalPrimary: "#161514",
    modalSecondary: "#111110",
    iconButton: "transparent",
    iconButtonHover: "#1C1B19",
    dropdownMenu: "#1C1B19",
    dropdownMenuSeparator: "rgba(250, 250, 229, 0.12)",
    walletItemSelected: "rgba(255, 71, 0, 0.10)",
    walletItemHover: "rgba(255, 71, 0, 0.06)",
  },
  borderColors: {
    outlineButton: "rgba(250, 250, 229, 0.22)",
  },
  colors: {
    primaryButton: "#FFFFFF",
    outlineButton: "#FAFAE5",
    iconButton: "rgba(250, 250, 229, 0.65)",
    body: "#FAFAE5",
    bodyMuted: "rgba(250, 250, 229, 0.50)",
    bodyDanger: "#FF4A4A",
  },
  radii: {
    small: "0px",
    medium: "0px",
    large: "0px",
    xlarge: "0px",
  },
  shadows: {
    primaryButton: "none",
    walletItemSelected: "none",
  },
  fontWeights: {
    normal: "400",
    medium: "500",
    bold: "700",
  },
  fontSizes: {
    small: "11px",
    medium: "13px",
    large: "16px",
    xlarge: "20px",
  },
  typography: {
    fontFamily:
      "'JetBrains Mono', 'Share Tech Mono', 'Courier New', monospace",
    fontStyle: "normal",
    lineHeight: "1.5",
    letterSpacing: "0.06em",
  },
};
