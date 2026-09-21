// The outlines words can be packed into.
//
// An outline is a MASK, not wordcloud2's `shape` option. That option only
// biases the order candidate positions are tried in: it searches out to the
// full diagonal of the grid, so with enough words the cloud grows straight
// through the outline and stops only at the canvas edge. Three attempts at a
// heart came out as a rectangle before that was clear.
//
// What does work is the other door. With clearCanvas off, wordcloud2 reads
// the canvas it was handed and treats every cell whose pixels differ from
// backgroundColor as already occupied. Painting everything outside the
// outline in a colour that is not the background turns the outline into a
// hard boundary that words cannot cross.
//
// Which outlines are offered is decided by how much detail a hundred words
// can carry, and that is not much. A word is a rectangle; the longest ones
// here run a third of the way across the picture. An outline is legible only
// where its features are larger than that.
//
// A circle and a heart qualify: both are single convex-ish masses whose one
// piece of detail - the heart's notch and its point - is a fair fraction of
// the whole. A cloud does not, and was cut after being built. A cloud is
// read by the notches BETWEEN its bumps, and at any size that fits a frame
// those notches are perhaps forty pixels across while the largest word is
// three hundred. Every version of it came out as a lumpy hill. It would work
// at several hundred words; this tool offers a hundred, and a web page
// rarely yields many more distinct ones than that.

// Every path below is drawn in a box `aspect` wide and 1 high, at the
// origin, and scaled UNIFORMLY to fit. Uniformly matters: scaling x and y by
// different factors turns every arc into an ellipse, so a shape written as
// circles has to be written in a box of its own proportions and then scaled
// by one number.

function circlePath(ctx) {
  ctx.moveTo(1, 0.5);
  ctx.arc(0.5, 0.5, 0.5, 0, 2 * Math.PI);
}

// Two cubics, the way a heart is usually drawn: the lobes meet in a notch at
// the top and the curve comes to a point at the bottom. Better than the
// cardioid wordcloud2 offers under the name, which is round at the far end -
// filled with words that reads as a circle somebody took a bite out of, and
// the point never arrives.
function heartPath(ctx) {
  ctx.moveTo(0.5, 1);
  ctx.bezierCurveTo(-0.08, 0.58, 0.12, 0.02, 0.5, 0.30);
  ctx.bezierCurveTo(0.88, 0.02, 1.08, 0.58, 0.5, 1);
}

export const shapes = {
  // The rectangle masks nothing: it lets the proportions through as
  // ellipticity and fills whatever it is given.
  rectangle: { path: null,       aspect: 1 },
  circle:    { path: circlePath, aspect: 1 },
  heart:     { path: heartPath,  aspect: 1 }
};

export const defaultShape = 'rectangle';

// What the studio actually offers, as one list.
//
// These were two controls - proportions, and outline - sitting next to each
// other under two names for the same idea. Both answered "what shape is the
// picture", so whichever way they were labelled one of them read as a
// mistake. They are one question, so they are one control.
//
// The three rectangles ARE the proportions; the outlines are inscribed and
// sized to the words, so proportions have almost nothing left to say about
// them - a heart on a 16:9 canvas is the same heart with wider margins.
export const forms = {
  landscape: { label: 'Landscape',  shape: 'rectangle', orientation: 'horizontal' },
  square:    { label: 'Square',     shape: 'rectangle', orientation: 'square' },
  portrait:  { label: 'Portrait',   shape: 'rectangle', orientation: 'vertical' },
  circle:    { label: 'Circle',     shape: 'circle',    orientation: 'square' },
  heart:     { label: 'Heart',      shape: 'heart',     orientation: 'square' }
};

export const defaultForm = 'square';

export function formOf(name) {
  return forms[name] || forms[defaultForm];
}

// How much of its own box each path covers, measured by rasterising it
// once rather than worked out by hand, so a path can be edited without
// anyone having to redo an integral.
const covered = new Map();
function coverage(name, path, aspect) {
  if (covered.has(name)) return covered.get(name);
  const size = 128;
  const probe = document.createElement('canvas');
  probe.width = probe.height = size;
  const ctx = probe.getContext('2d', { willReadFrequently: true });
  // Drawn into the probe the same way trace() draws into the canvas, so the
  // fraction measured is the fraction painted.
  ctx.scale(size / Math.max(1, aspect), size / Math.max(1, aspect));
  ctx.beginPath();
  path(ctx);
  ctx.fill();
  const { data } = ctx.getImageData(0, 0, size, size);
  let inside = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] > 127) inside++;
  // Back out of the probe's own box into the path's box of aspect x 1.
  const ratio = inside / (size * size) * (Math.max(1, aspect) * Math.max(1, aspect)) / aspect;
  covered.set(name, ratio);
  return ratio;
}

// Everything the renderer needs for one outline on a given canvas. Returns
// null for the rectangle, which wants none of it.
export function plan(name, width, height) {
  const shape = shapes[name] || shapes[defaultShape];
  if (!shape.path) return null;

  // The largest box of the path's own proportions that fits the canvas.
  let boxW = width;
  let boxH = boxW / shape.aspect;
  if (boxH > height) { boxH = height; boxW = boxH * shape.aspect; }

  const boxCover = coverage(name, shape.path, shape.aspect);

  return {
    // The outline is sized to the WORDS, not to the canvas.
    //
    // Inscribing it in the frame and hoping the words fill it is what made
    // the first outlines unreadable. A real masked word cloud is carried by
    // hundreds of words; this one offers at most a hundred, and a web page
    // rarely yields many more distinct ones than that. Scaled to the frame,
    // a hundred words either come out enormous - a dozen of them describing
    // the whole boundary, so every curve reads as a lumpy polygon - or, once
    // they are small enough to follow a curve, they run out and leave a
    // small clot in the middle of an empty outline.
    //
    // So the outline shrinks to the ink instead. `inkArea` is how much the
    // words will actually cover; PACKING is how much of a region word
    // packing fills before it gives up, measured rather than assumed. What
    // comes back is the largest version of the shape those words can fill.
    fit(inkArea) {
      const PACKING = 0.58;
      const wanted = inkArea / PACKING;
      const have = boxCover * boxW * boxH;
      const k = Math.min(1, Math.sqrt(wanted / have));
      const w = boxW * k, h = boxH * k;
      const ox = (width - w) / 2, oy = (height - h) / 2;
      return {
        trace(ctx, inset = 0) {
          const shrink = Math.max(0, h - 2 * inset) / h;
          ctx.beginPath();
          ctx.save();
          ctx.translate(ox + w / 2, oy + h / 2);
          ctx.scale(h * shrink, h * shrink);
          ctx.translate(-shape.aspect / 2, -0.5);
          shape.path(ctx);
          ctx.restore();
        }
      };
    }
  };
}
