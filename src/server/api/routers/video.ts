import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { env } from "~/env.mjs";

export const videoRouter = createTRPCRouter({
  getAll: protectedProcedure.query(
    async ({ ctx: { prisma, session, supabase, posthog } }) => {
      const videos = await prisma.video.findMany({
        where: {
          userId: session.user.id,
        },
      });

      posthog?.capture({
        distinctId: session.user.id,
        event: "viewing video list",
        properties: {
          videoAmount: videos.length,
        },
      });
      void posthog?.shutdownAsync();

      const videosWithThumbnailUrl = await Promise.all(
        videos.map(async (video) => {
          const { data } = await supabase.storage
            .from("videos")
            .createSignedUrl(
              `${video.userId}/${video.id}-thumbnail`,
              60 * 60
            );

          return { ...video, thumbnailUrl: data?.signedUrl || "" };
        })
      );

      return videosWithThumbnailUrl;
    }
  ),
  get: publicProcedure
    .input(z.object({ videoId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { supabase, posthog, session, prisma } = ctx;
      const video = await prisma.video.findUnique({
        where: {
          id: input.videoId,
        },
        include: {
          user: true,
        },
      });
      if (!video) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      if (video.userId !== session?.user.id && !video.sharing) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      if (session) {
        posthog?.capture({
          distinctId: session.user.id,
          event: "viewing video",
          properties: {
            videoId: video.id,
            videoCreatedAt: video.createdAt,
            videoUpdatedAt: video.updatedAt,
            videoUser: video.user.id,
            videoSharing: video.sharing,
            videoDeleteAfterLinkExpires: video.delete_after_link_expires,
            videoShareLinkExpiresAt: video.shareLinkExpiresAt,
          },
        });
        void posthog?.shutdownAsync();
      }

      const { data: videoData } = await supabase.storage
        .from("videos")
        .createSignedUrl(`${video.userId}/${video.id}`, 60 * 60);

      const { data: thumbnailData } = await supabase.storage
        .from("videos")
        .createSignedUrl(`${video.userId}/${video.id}-thumbnail`, 60 * 60);

      return {
        ...video,
        video_url: videoData?.signedUrl || "",
        thumbnailUrl: thumbnailData?.signedUrl || "",
      };
    }),
  getUploadUrl: protectedProcedure
    .input(z.object({ key: z.string() }))
    .mutation(async ({ ctx: { prisma, session, supabase, posthog }, input }) => {
      const { key } = input;

      const videos = await prisma.video.findMany({
        where: {
          userId: session.user.id,
        },
      });

      if (
        session.user.stripeSubscriptionStatus !== "active" &&
        !!env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
      ) {
        posthog?.capture({
          distinctId: session.user.id,
          event: "hit video upload limit",
          properties: {
            videoAmount: videos.length,
            stripeSubscriptionStatus: session.user.stripeSubscriptionStatus,
          },
        });
        void posthog?.shutdownAsync();

        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Sorry, you have reached the maximum video upload limit on our free tier. Please upgrade to upload more.",
        });
      }

      posthog?.capture({
        distinctId: session.user.id,
        event: "uploading video",
        properties: {
          videoAmount: videos.length,
          stripeSubscriptionStatus: session.user.stripeSubscriptionStatus,
        },
      });
      void posthog?.shutdownAsync();

      const video = await prisma.video.create({
        data: {
          userId: session.user.id,
          title: key,
        },
      });

      const { data: videoUploadData } = await supabase.storage
        .from("videos")
        .createSignedUploadUrl(`${session.user.id}/${video.id}`);

      const { data: thumbnailUploadData } = await supabase.storage
        .from("videos")
        .createSignedUploadUrl(`${video.userId}/${video.id}-thumbnail`);

      return {
        success: true,
        id: video.id,
        signedVideoUrl: videoUploadData?.signedUrl || "",
        signedThumbnailUrl: thumbnailUploadData?.signedUrl || "",
        videoToken: videoUploadData?.token || "",
        thumbnailToken: thumbnailUploadData?.token || "",
      };
    }),
  setSharing: protectedProcedure
    .input(z.object({ videoId: z.string(), sharing: z.boolean() }))
    .mutation(async ({ ctx: { prisma, session, posthog }, input }) => {
      const updateVideo = await prisma.video.updateMany({
        where: {
          id: input.videoId,
          userId: session.user.id,
        },
        data: {
          sharing: input.sharing,
        },
      });

      if (updateVideo.count === 0) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      posthog?.capture({
        distinctId: session.user.id,
        event: "update video setSharing",
        properties: {
          videoId: input.videoId,
          videoSharing: input.sharing,
        },
      });
      void posthog?.shutdownAsync();

      return {
        success: true,
        updateVideo,
      };
    }),
  setDeleteAfterLinkExpires: protectedProcedure
    .input(
      z.object({ videoId: z.string(), delete_after_link_expires: z.boolean() })
    )
    .mutation(async ({ ctx: { prisma, session, posthog }, input }) => {
      const updateVideo = await prisma.video.updateMany({
        where: {
          id: input.videoId,
          userId: session.user.id,
        },
        data: {
          delete_after_link_expires: input.delete_after_link_expires,
        },
      });

      if (updateVideo.count === 0) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      posthog?.capture({
        distinctId: session.user.id,
        event: "update video delete_after_link_expires",
        properties: {
          videoId: input.videoId,
          delete_after_link_expires: input.delete_after_link_expires,
        },
      });
      void posthog?.shutdownAsync();

      return {
        success: true,
        updateVideo,
      };
    }),
  setShareLinkExpiresAt: protectedProcedure
    .input(
      z.object({
        videoId: z.string(),
        shareLinkExpiresAt: z.nullable(z.date()),
      })
    )
    .mutation(async ({ ctx: { prisma, session, posthog }, input }) => {
      const updateVideo = await prisma.video.updateMany({
        where: {
          id: input.videoId,
          userId: session.user.id,
        },
        data: {
          shareLinkExpiresAt: input.shareLinkExpiresAt,
        },
      });

      if (updateVideo.count === 0) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      posthog?.capture({
        distinctId: session.user.id,
        event: "update video shareLinkExpiresAt",
        properties: {
          videoId: input.videoId,
          shareLinkExpiresAt: input.shareLinkExpiresAt,
        },
      });
      void posthog?.shutdownAsync();

      return {
        success: true,
        updateVideo,
      };
    }),
  renameVideo: protectedProcedure
    .input(
      z.object({
        videoId: z.string(),
        title: z.string(),
      })
    )
    .mutation(async ({ ctx: { prisma, session, posthog }, input }) => {
      const updateVideo = await prisma.video.updateMany({
        where: {
          id: input.videoId,
          userId: session.user.id,
        },
        data: {
          title: input.title,
        },
      });

      if (updateVideo.count === 0) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      posthog?.capture({
        distinctId: session.user.id,
        event: "update video title",
        properties: {
          videoId: input.videoId,
          title: input.title,
        },
      });
      void posthog?.shutdownAsync();

      return {
        success: true,
        updateVideo,
      };
    }),
  deleteVideo: protectedProcedure
    .input(
      z.object({
        videoId: z.string(),
      })
    )
    .mutation(async ({ ctx: { prisma, session, supabase, posthog }, input }) => {
      const deleteVideo = await prisma.video.deleteMany({
        where: {
          id: input.videoId,
          userId: session.user.id,
        },
      });

      if (deleteVideo.count === 0) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      posthog?.capture({
        distinctId: session.user.id,
        event: "video delete",
        properties: {
          videoId: input.videoId,
        },
      });
      void posthog?.shutdownAsync();

      const { data: deleteVideoData, error: deleteVideoError } =
        await supabase.storage
          .from("videos")
          .remove([`${session.user.id}/${input.videoId}`]);

      const { data: deleteThumbnailData, error: deleteThumbnailError } =
        await supabase.storage
          .from("videos")
          .remove([`${session.user.id}/${input.videoId}-thumbnail`]);

      return {
        success: true,
        deleteVideo,
        deleteVideoObject: deleteVideoData,
        deleteThumbnailObject: deleteThumbnailData,
      };
    }),
});
