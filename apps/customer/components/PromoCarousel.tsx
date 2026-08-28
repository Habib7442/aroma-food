import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useVideoPlayer, VideoView } from "expo-video";
import { useCallback, useState } from "react";
import {
  FlatList,
  Image,
  Linking,
  Modal,
  Pressable,
  useWindowDimensions,
  View,
  type ViewToken,
} from "react-native";

import { supabase } from "../lib/supabase";

type PlatformBannerMediaType = "image" | "video" | "youtube";

interface PlatformBannerRow {
  id: string;
  media_type: PlatformBannerMediaType;
  media_url: string;
}

function youtubeThumbnail(url: string): string | null {
  const match = url.match(/(?:v=|youtu\.be\/)([\w-]+)/);
  return match ? `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg` : null;
}

// A player instance is only created once a video is actually opened, not
// one per slide — expo-video's decoder is real per-instance cost, and the
// carousel itself never needs more than a static thumbnail.
function VideoPlayerModal({ url, onClose }: { url: string; onClose: () => void }) {
  const player = useVideoPlayer(url, (p) => {
    p.play();
  });

  return (
    <Modal visible animationType="fade" transparent onRequestClose={onClose}>
      <Pressable onPress={onClose} className="flex-1 items-center justify-center bg-black/90 px-4">
        <VideoView player={player} style={{ width: "100%", aspectRatio: 16 / 9 }} nativeControls />
        <Pressable
          onPress={onClose}
          hitSlop={8}
          className="absolute right-5 top-14 h-10 w-10 items-center justify-center rounded-full bg-white/15"
        >
          <Ionicons name="close" size={22} color="#FFFFFF" />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const VIEWABILITY_CONFIG = { itemVisiblePercentThreshold: 60 };

// Platform-wide promos (admin-managed, apps/admin's Promos page) — a
// standalone rounded card carousel with its own pagination dots, sitting
// below the header/search rather than behind them. These are finished
// marketing graphics with their own logo/text baked in, so putting other
// UI on top of one fights it for space instead of complementing it.
// Renders nothing at all when there are no active banners.
export function PromoCarousel() {
  const [expandedVideoUrl, setExpandedVideoUrl] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = screenWidth - 40;
  const cardHeight = cardWidth / 2.2;

  const { data: banners } = useQuery({
    queryKey: ["platform-banners", "public"],
    queryFn: async (): Promise<PlatformBannerRow[]> => {
      // platform_banners_select_public already restricts this to is_active
      // rows — nothing further to filter client-side.
      const { data, error } = await supabase.from("platform_banners").select("id, media_type, media_url").order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems[0]?.index != null) setActiveIndex(viewableItems[0].index);
  }, []);

  if (!banners || banners.length === 0) return null;

  return (
    <View className="mt-3 gap-2">
      <View style={{ height: cardHeight }}>
        <FlatList
          horizontal
          pagingEnabled
          data={banners}
          keyExtractor={(banner) => banner.id}
          showsHorizontalScrollIndicator={false}
          snapToInterval={cardWidth + 12}
          decelerationRate="fast"
          contentContainerStyle={{ gap: 12, paddingHorizontal: 20 }}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={VIEWABILITY_CONFIG}
          renderItem={({ item: banner }) => {
            if (banner.media_type === "image") {
              return (
                <Image
                  source={{ uri: banner.media_url }}
                  style={{ height: cardHeight, width: cardWidth }}
                  className="rounded-2xl bg-background"
                  resizeMode="cover"
                />
              );
            }

            // video and youtube both render as a thumbnail + play button —
            // youtube opens externally (no in-app embed), video opens the
            // in-app full-screen player above.
            const thumbnail = banner.media_type === "youtube" ? youtubeThumbnail(banner.media_url) : null;
            return (
              <Pressable
                onPress={() =>
                  banner.media_type === "youtube" ? Linking.openURL(banner.media_url) : setExpandedVideoUrl(banner.media_url)
                }
                style={{ height: cardHeight, width: cardWidth }}
                className="items-center justify-center overflow-hidden rounded-2xl bg-primary-dark"
              >
                {thumbnail ? (
                  <Image
                    source={{ uri: thumbnail }}
                    style={{ width: "100%", height: "100%", position: "absolute" }}
                    resizeMode="cover"
                  />
                ) : null}
                <View className="h-14 w-14 items-center justify-center rounded-full bg-black/50">
                  <Ionicons name="play" size={26} color="#FFFFFF" />
                </View>
              </Pressable>
            );
          }}
        />
      </View>

      {banners.length > 1 ? (
        <View className="flex-row items-center justify-center gap-1.5">
          {banners.map((banner, index) => (
            <View
              key={banner.id}
              className={`rounded-full ${index === activeIndex ? "h-1.5 w-4 bg-primary" : "h-1.5 w-1.5 bg-border"}`}
            />
          ))}
        </View>
      ) : null}

      {expandedVideoUrl ? <VideoPlayerModal url={expandedVideoUrl} onClose={() => setExpandedVideoUrl(null)} /> : null}
    </View>
  );
}
