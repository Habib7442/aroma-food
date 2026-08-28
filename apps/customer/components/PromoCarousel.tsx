import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useVideoPlayer, VideoView } from "expo-video";
import { useState } from "react";
import { FlatList, Image, Linking, Modal, Pressable, View } from "react-native";

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
// one per carousel card — expo-video's decoder is real per-instance cost,
// and the carousel itself never needs more than a static thumbnail.
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

// Platform-wide promos (admin-managed, apps/admin's Promos page) — distinct
// from a restaurant's own promo banners. Renders nothing at all when empty
// rather than an empty carousel strip, so a fresh install with no promos
// yet configured doesn't show a blank bar.
export function PromoCarousel() {
  const [expandedVideoUrl, setExpandedVideoUrl] = useState<string | null>(null);

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

  if (!banners || banners.length === 0) return null;

  return (
    <>
      <FlatList
        horizontal
        data={banners}
        keyExtractor={(banner) => banner.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 10, padding: 12 }}
        renderItem={({ item: banner }) => {
          if (banner.media_type === "image") {
            return (
              <Image
                source={{ uri: banner.media_url }}
                style={{ height: 140, width: 320 }}
                className="rounded-xl bg-background"
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
              style={{ height: 140, width: 320 }}
              className="items-center justify-center overflow-hidden rounded-xl bg-primary-dark"
            >
              {thumbnail ? (
                <Image source={{ uri: thumbnail }} style={{ width: "100%", height: "100%", position: "absolute" }} resizeMode="cover" />
              ) : null}
              <View className="h-14 w-14 items-center justify-center rounded-full bg-black/50">
                <Ionicons name="play" size={26} color="#FFFFFF" />
              </View>
            </Pressable>
          );
        }}
      />
      {expandedVideoUrl ? <VideoPlayerModal url={expandedVideoUrl} onClose={() => setExpandedVideoUrl(null)} /> : null}
    </>
  );
}
