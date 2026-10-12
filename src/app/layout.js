import "./globals.css";
import Shell from "@/components/Shell";

export const metadata = {
  title: "Old Mutual Infrastructure Monitor",
  description: "Live network and service monitoring with anomaly detection",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
