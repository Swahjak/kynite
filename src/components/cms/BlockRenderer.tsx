"use client";

import { HeroSection, type HeroBlockData } from "./HeroSection";
import { FeaturesSection, type FeaturesBlockData } from "./FeaturesSection";
import { PricingSection, type PricingBlockData } from "./PricingSection";
import { CtaSection, type CtaBlockData } from "./CtaSection";

// Union type of all block data types
export type BlockData =
  | HeroBlockData
  | FeaturesBlockData
  | PricingBlockData
  | CtaBlockData;

interface BlockRendererProps {
  blocks: BlockData[];
}

/**
 * Maps blockType to its corresponding component and renders all blocks.
 * This component takes an array of block data from Payload CMS and
 * renders the appropriate component for each block type.
 */
export function BlockRenderer({ blocks }: BlockRendererProps) {
  if (!blocks || blocks.length === 0) {
    return null;
  }

  return (
    <>
      {blocks.map((block, index) => (
        <Block key={`${block.blockType}-${index}`} block={block} />
      ))}
    </>
  );
}

interface BlockProps {
  block: BlockData;
}

function Block({ block }: BlockProps) {
  switch (block.blockType) {
    case "hero":
      return <HeroSection data={block} />;
    case "features":
      return <FeaturesSection data={block} />;
    case "pricing":
      return <PricingSection data={block} />;
    case "cta":
      return <CtaSection data={block} />;
    default:
      // TypeScript exhaustive check - this should never happen
      const _exhaustiveCheck: never = block;
      console.warn(
        `Unknown block type: ${(_exhaustiveCheck as BlockData).blockType}`
      );
      return null;
  }
}
