// Drawing the cloud, and getting it back out as a file.

import { rampFor, fillFor, grounds, defaultGround } from './palette.js';
import { plan, defaultShape, shapes } from './shapes.js';

// The canvas is drawn at twice its displayed size and scaled down by CSS.
//
// 1.x sized the backing store to the popup's own box - about 300px - so the
// PNG people saved was 300px, which is unusable anywhere a word cloud is
// worth having. wordcloud2 divides by canvas.width / rect.width when it
// hit-tests, so the oversized backing store costs nothing: clicking a word
// still lands on that word.
const SCALE = 2;

const RATIOS = {
  horizontal: 16 / 9,
  square: 1,
  vertical: 9 / 16
};

// The largest box of the requested shape that fits the space available.
function layout(box, orientation) {
  const ratio = RATIOS[orientation] ?? RATIOS.square;
  let width = box.width;
  let height = width / ratio;
  if (height > box.height) {
    height = box.height;
    width = height * ratio;
  }
  return { width: Math.max(1, Math.floor(width)), height: Math.max(1, Math.floor(height)) };
}

export function draw(canvas, options) {
  const {
    words, box, scheme, ground = defaultGround, orientation = 'square',
    shape = defaultShape, onPick
  } = options;

  const { width, height } = layout(box, orientation);

  // Two words of the same size placed side by side with no gap read as one
  // word - "contrast" beside "button" became "contrastbutton". The grid is
  // what holds them apart, and it is measured against the backing store,
  // which is twice the displayed size.
  //
  // Kept even, so that a whole number of cells is also a whole number of
  // CSS pixels once SCALE is divided back out.
  //
  // An outline halves it. The mask is read a cell at a time - a cell with
  // any masked pixel in it is occupied - so the grid is also the resolution
  // the outline is quantised to. At the rectangle's spacing, a heart's point
  // is narrower than one cell and disappears entirely. The cost is that
  // words sit closer together inside an outline, which is the right trade:
  // an outline is read by its edge, and its edge is made of small words.
  const shaped = Boolean((shapes[shape] || {}).path);
  const base = Math.max(3, Math.round(11 * width * SCALE / 1024));
  const grid = 2 * (shaped ? Math.max(3, Math.round(base / 2)) : base);

  // The backing store is then cut down to a whole number of grid cells.
  //
  // wordcloud2 takes ngx = Math.ceil(canvas.width / gridSize), so when the
  // width is not a multiple of the grid, the last column runs past the right
  // edge of the canvas - and a word placed in it is drawn over the edge and
  // clipped, whatever drawOutOfBound says, because as far as the library is
  // concerned that column is inside the grid. A 1148px canvas on a 22px grid
  // overhangs by 17px, which is most of a letter.
  canvas.width = Math.max(grid, Math.floor(width * SCALE / grid) * grid);
  canvas.height = Math.max(grid, Math.floor(height * SCALE / grid) * grid);
  canvas.style.width = (canvas.width / SCALE) + 'px';
  canvas.style.height = (canvas.height / SCALE) + 'px';

  const ramp = rampFor(scheme, ground);
  const fill = fillFor(ground);

  const outline = plan(shape, canvas.width, canvas.height);

  // An outline gets smaller type than a rectangle - a curve has to be
  // described by something finer than a word half its width - but not so
  // small that the words vanish. The outline is then fitted to whatever
  // these sizes add up to, rather than the other way round.
  const maxSize = Math.min(canvas.width, canvas.height) / (outline ? 9 : 5);
  const minSize = (outline ? 11 : 14) * SCALE;
  const top = words.length ? words[0][1] : 1;

  // Counts to point sizes. The top word anchors the scale, so a cloud of
  // one dominant word and a cloud of thirty even ones both fill the canvas.
  const sized = words.map(([word, count]) => [
    word,
    minSize + (count / top) * (maxSize - minSize)
  ]);

  // How much canvas the words will actually cover, so the outline can be
  // fitted to them. A word's box is about 0.58 of its font size per
  // character across and about 1.15 down - close enough, since the packing
  // constant on the other side of this was measured against the same guess.
  const inkArea = sized.reduce(
    (total, [word, size]) => total + (0.58 * word.length * size) * (1.15 * size), 0);
  const fitted = outline ? outline.fit(inkArea) : null;

  // The mask.
  //
  // Painted in three composites rather than one even-odd fill, because
  // several outlines are unions of overlapping subpaths - a cloud is four
  // circles and a bar - and under even-odd every overlap punches a hole, so
  // the cloud would come out as a string of crescents.
  //
  //   1. the whole canvas in a colour that is not the background
  //   2. destination-out the outline, which cuts the shape back out of it
  //   3. destination-over the ground, which flows in behind, through the hole
  //
  // What is left is the ground inside the outline and MASK everywhere else,
  // which is exactly what wordcloud2 reads as free and occupied. On a
  // transparent ground step 3 is skipped and the hole stays transparent,
  // which is what its own background pixel is.
  const MASK = '#ff00ff';
  const ctx = canvas.getContext('2d');
  if (!fitted) ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (fitted) {
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = MASK;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.globalCompositeOperation = 'destination-out';
    fitted.trace(ctx);
    ctx.fill();

    if (fill !== 'transparent') {
      ctx.globalCompositeOperation = 'destination-over';
      ctx.fillStyle = fill;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.restore();

    // Lifted once the last word is down, by the same two composites in
    // reverse: keep only what is inside the outline, then put the ground
    // back behind everything. destination-in clips on the outline itself,
    // so no hairline of mask colour is left on the boundary - which a
    // straight fill of the outside does leave, along its antialiased edge.
    canvas.addEventListener('wordcloudstop', function lift() {
      canvas.removeEventListener('wordcloudstop', lift);
      ctx.save();
      ctx.globalCompositeOperation = 'destination-in';
      ctx.fillStyle = '#000000';
      fitted.trace(ctx, 2);
      ctx.fill();
      if (fill !== 'transparent') {
        ctx.globalCompositeOperation = 'destination-over';
        ctx.fillStyle = fill;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.restore();
    });
  }

  // An outline covers a fraction of the rectangle, so the type comes down
  // with it. Without this, words scaled to fill a rectangle simply do not
  // fit inside a heart, and what gets drawn is a handful of huge ones.
  // An outline covers a fraction of the rectangle, so the type comes down
  // with it - and then down again, because an outline is only read at all
  // if there are enough small words to carry its edge. Words scaled to fill
  // a rectangle do not fit inside a heart: they get shrunk or dropped, and
  // what is drawn is a handful of huge ones in a blob.
  //
  // BOTH ends come down together. Scaling only the largest word leaves the
  // smallest one at the rectangle's size, and the smallest words are the
  // ones that have to reach into a lobe of the cloud or the point of the
  // heart. With only the top scaled, the middle of the outline filled and
  // its extremities stayed empty, so the silhouette never closed.
  // Small words take the front of the ramp, large words the back. Both ends
  // clear 4.5:1 (see palette.js), so this is not about legibility - it is
  // that a colour repeated across the three biggest words reads as a
  // grouping the text does not have.
  const colourFor = fontSize => {
    const index = Math.floor((fontSize / maxSize) * (ramp.length - 1));
    return ramp[Math.max(0, Math.min(ramp.length - 1, index))];
  };

  WordCloud(canvas, {
    list: sized,
    gridSize: grid,
    weightFactor: 1,
    fontFamily: 'Segoe UI, Arial, sans-serif',
    color: (word, weight, fontSize) => colourFor(fontSize),
    rotateRatio: 0.1,
    rotationSteps: 2,
    drawOutOfBound: false,
    shrinkToFit: true,
    clearCanvas: !outline,
    minSize,
    // The rectangle is the only outline that fills the frame it is given:
    // it takes wordcloud2's own square and lets the frame's proportions
    // through as ellipticity. Every other outline is inscribed undistorted,
    // so ellipticity has to come back to 1 or the heart comes out stretched.
    // The mask is what constrains an outline. This only decides the order
    // positions are tried in, so inside an outline the plain circle - fill
    // from the middle outwards - is the right growth to give it.
    shape: outline ? 'circle' : 'square',
    // The rectangle is the only outline that fills the frame it is given, so
    // it is the only one that lets the frame's proportions through here. An
    // inscribed outline has to come back to 1 or the heart comes out
    // stretched into the frame's shape.
    ellipticity: outline ? 1
      : (orientation === 'vertical' ? 1.6 : (orientation === 'horizontal' ? 0.625 : 1)),
    backgroundColor: fill,
    // 1.x set canvas.onerror here and put a simplified re-render behind it.
    // A <canvas> does not fire error events, so that branch had never run
    // once; it is gone rather than reworded.
    // No hover callback: passing one makes wordcloud2 attach a mousemove
    // listener, and nothing was being done with it. What a word needs is to
    // look clickable, and the canvas's own cursor says that already.
    click: (item) => { if (item) onPick?.(item[0]); }
  });
}

export function toPng(canvas, filename) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) { reject(new Error('no-blob')); return; }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = filename;
      link.href = url;
      link.click();
      // Revoked on the next frame rather than immediately: the click is
      // dispatched synchronously but the download reads the blob after it.
      requestAnimationFrame(() => URL.revokeObjectURL(url));
      resolve();
    }, 'image/png');
  });
}
