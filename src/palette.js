// The colours the cloud itself is painted in.
//
// Every value here was measured against WCAG 2.2 and measured again under
// simulated protanopia, deuteranopia and tritanopia. Each stop clears 4.5:1
// against the ground it is used on, under all four views. Before changing
// one, re-measure - the validator reads this file and fails on drift.
//
// The stops vary by HUE, not by lightness. A ramp that runs pale at one end
// cannot hold 4.5:1 there, and the pale end is where the largest words land,
// so the biggest word on the canvas would be the least legible thing on it.
// Traditional Chinese colour naming is well supplied with distinct hues at
// the same depth, which is what makes this work: 靛青 and 青黛 read as two
// colours without either of them being paler than the other.
//
// Each scheme carries two ramps because the dark ground is not the light
// ground with the numbers flipped. 2.0 replaces the old lightenColor(),
// which mixed 40% white into whatever it was given: a measured colour put
// through it is no longer a measured colour.

export const schemes = {
  indigo: {
    label: 'Indigo 靛青',
    light: ['#1661ab', '#1a3a5f', '#2e3a62', '#34547a', '#424c50'],
    //       靛青       青黛       绀青       黛蓝       鸦青
    dark:  ['#d6ecf0', '#e9f1f6', '#a4c4d7', '#b3c9dd', '#9fd3e0']
    //       月白       霜色       淡青       蓝灰       秋波
  },
  cinnabar: {
    label: 'Cinnabar 朱砂',
    light: ['#981e22', '#8c4356', '#7c4b3a', '#622a1d', '#8a4030'],
    //       赤         绛         赭石       玄         檀
    //       檀 is darkened from its usual #9b4a3c, which measures 4.08:1
    //       under tritanopia - the same reason the siblings darkened 赤.
    dark:  ['#edd1d8', '#f3a7a2', '#ee7b6d', '#f6c5c0', '#e8909b']
    //       藕荷       绯         妃色       桃         海棠
  },
  celadon: {
    label: 'Celadon 缥碧',
    light: ['#2a6e3f', '#426666', '#1f6f5c', '#4e6b4a', '#2c6e6e'],
    //       官绿       黛绿       松绿       竹青       缥碧
    dark:  ['#9ed048', '#bce672', '#bddd22', '#a8d8c8', '#d9e17b']
    //       豆绿       松花       嫩绿       缥         柳黄
  },
  ink: {
    label: 'Ink 墨',
    light: ['#1a1a17', '#33322c', '#4f4d45', '#424c50', '#5c5a50'],
    //       焦墨       重墨       淡墨       鸦青       苍
    dark:  ['#e6e4da', '#d2d0c6', '#bcbab0', '#d6ecf0', '#f7f4ed']
    //       素         霜         银灰       月白       鱼肚白
  }
};

// Transparent is measured as 鱼肚白, because that is the ground the canvas
// is drawn on inside the studio. A transparent export can be dropped on
// anything, and no palette can answer for that.
export const grounds = {
  transparent: { label: 'Transparent', fill: 'transparent', ramp: 'light' },
  paper:       { label: 'Paper',       fill: '#f7f4ed',     ramp: 'light' },
  white:       { label: 'White',       fill: '#ffffff',     ramp: 'light' },
  ink:         { label: 'Ink',         fill: '#1f2022',     ramp: 'dark'  }
};

const defaultScheme = 'indigo';
export const defaultGround = 'paper';

// Which ramp a scheme uses is decided by the ground, never by the scheme.
export function rampFor(schemeName, groundName) {
  const scheme = schemes[schemeName] || schemes[defaultScheme];
  const ground = grounds[groundName] || grounds[defaultGround];
  return scheme[ground.ramp];
}

export function fillFor(groundName) {
  return (grounds[groundName] || grounds[defaultGround]).fill;
}
