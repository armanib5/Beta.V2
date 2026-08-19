import { resolveBrandAssets } from "@/lib/brand-assets";
import { HomeScreen } from "@/components/home/home-screen";

/**
 * Home Screen route. Server component so the finalized brand artwork in
 * public/brand/ can be resolved once at build time and handed to the
 * client Home Screen; everything else on the page is client-side, exactly
 * as before.
 */
export default function HomePage() {
  return <HomeScreen brandAssets={resolveBrandAssets()} />;
}
