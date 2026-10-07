import "./globals.css";

export const metadata = {
  title: "Smart Gallery AI - Auto-Tagging Photos",
  description: "A smart photo gallery MVP that automatically tags your images using AI on upload, allowing you to easily search for them later.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
