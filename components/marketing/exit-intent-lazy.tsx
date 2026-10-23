"use client";
/**
 * The exit-intent offer is behind a flag. Next ships JS for every client component a layout
 * imports, rendered or not, so the dialog code is only fetched when the offer actually renders.
 */
import dynamic from "next/dynamic";

export const ExitIntentOfferLazy = dynamic(() => import("./exit-intent").then((m) => m.ExitIntentOffer), { ssr: false });
