/** A scroll-scrubbed image sequence made by scripts/make-sequence.ts. */
export interface FrameSequence {
  /** Number of frames; files are 001.webp … NNN.webp. */
  count: number;
  /** Width / height of the source video. */
  aspect: number;
  /** Folder of 1600px frames. */
  desktop: string;
  /** Folder of 900px frames for phones. */
  mobile: string;
  /** First frame (phone size), shown before frames load. */
  posterStart: string;
  /** Last frame (desktop size), the finished result for reduced motion / data saver. */
  posterEnd: string;
}
