# Stackimals visual source

All visible game art in this repository is original work generated for Stackimals. No artwork,
logos, audio, or UI assets from *Animal Tower Battle* or *In the Jungle* are included.

## Accepted concept

[`stackimals-gameplay-concept-v1.png`](./stackimals-gameplay-concept-v1.png) is the accepted visual
direction: a portrait mobile playfield, tactile wooden controls, a paper-cut mountain backdrop,
rope-framed platform, compact versus HUD, and warm hand-painted animal blocks.

Concept prompt summary:

> Design a polished portrait mobile animal-stacking game named Stackimals. Show a clear player vs
> friendly AI HUD, a tall unobstructed paper-cut mountain playfield, suspension ropes, a wooden
> platform, one preview animal, and large rotate/drop controls. Use handcrafted children's toy
> materials, navy/coral/cream accents, readable silhouettes, and no copied game branding or art.

## Asset set

The eight animal source renders and environment pieces live in `assets-src/generated-v1/`. Each
animal was generated separately with this shared direction:

> A single friendly woodland animal as a tactile hand-painted wooden puzzle block, three-quarter
> side view, thick dark-blue ink outline, slightly imperfect carved edge, warm storybook colors,
> centered and isolated on a transparent background, no text, no frame, no shadow, no extra props.

The portrait background, 16:9 desktop background, and platform use the same paper-cut/painted-wood
language. Runtime files in `public/assets/game/` are optimized WebP derivatives and may retain
intentional transparent padding. The desktop background is a wide continuation of the accepted
mountain-valley scene so landscape layouts do not have to enlarge and crop the portrait source.
Collision outlines are traced from source alpha offline, reviewed, and committed as TypeScript data;
the runtime never infers collision geometry from image alpha.
