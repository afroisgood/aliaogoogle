import * as THREE from 'three';
import { STYLE } from './kit.js';

// 畫面輸出：場景先算到一張貼圖，再用後製決定風格——低解析度放大、色階、網點、描邊、色調（見 kit.js 的 STYLE）。
//   createRenderer(canvas) 回傳 { renderer, resize(camera), render(scene, camera) }
export function createRenderer(canvas) {
  const FULL = !STYLE.h;                               // 全解析度風格
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.setPixelRatio(1);
  if (STYLE.shadows) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = STYLE.pixel ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;      // 場景是靜態的，陰影只算一次
    renderer.shadowMap.needsUpdate = true;
  }
  if (FULL) canvas.style.imageRendering = 'auto';
  const filter = FULL ? THREE.LinearFilter : THREE.NearestFilter;
  const target = new THREE.WebGLRenderTarget(320, 240, { magFilter: filter, minFilter: filter, samples: FULL ? 4 : 0 });
  target.depthTexture = new THREE.DepthTexture(320, 240);
  const post = new THREE.ShaderMaterial({
    uniforms: {
      tex: { value: target.texture }, depthTex: { value: target.depthTexture },
      texel: { value: new THREE.Vector2(1 / 320, 1 / 240) },
      levels: { value: STYLE.levels }, dither: { value: STYLE.dither },
      outline: { value: STYLE.outline || 0 }, tonemap: { value: STYLE.tonemap || 0 },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
    fragmentShader: `
      uniform sampler2D tex, depthTex; uniform vec2 texel;
      uniform float levels, dither, outline, tonemap;
      varying vec2 vUv;
      float bayer(vec2 p){
        int x = int(mod(p.x, 4.)), y = int(mod(p.y, 4.));
        int i = x + y * 4;
        float m[16];
        m[0]=0.;m[1]=8.;m[2]=2.;m[3]=10.;m[4]=12.;m[5]=4.;m[6]=14.;m[7]=6.;
        m[8]=3.;m[9]=11.;m[10]=1.;m[11]=9.;m[12]=15.;m[13]=7.;m[14]=13.;m[15]=5.;
        for (int k = 0; k < 16; k++) if (k == i) return m[k] / 16. - .5;
        return 0.;
      }
      // 深度轉成實際距離（公尺），near/far 與相機設定一致
      float dist(vec2 uv){ float z = texture2D(depthTex, uv).x * 2. - 1.; return 2. * .04 * 60. / (60. + .04 - z * (60. - .04)); }
      float lum(vec2 uv){ return dot(texture2D(tex, uv).rgb, vec3(.3, .59, .11)); }
      void main(){
        vec3 c = texture2D(tex, vUv).rgb;
        if (tonemap > .5) {                      // 柔和的底片色調、微暖
          c *= vec3(1.04, 1., .93) * .82;
          c = (c * (2.51 * c + .03)) / (c * (2.43 * c + .59) + .14);
        }
        c = pow(clamp(c, 0., 1.), vec3(1. / 2.2));
        if (outline > .5) {                      // 墨線：深度或明暗突然改變的地方
          vec2 t = texel * 1.3;
          float d = dist(vUv);
          float dd = abs(dist(vUv + vec2(t.x, 0.)) + dist(vUv - vec2(t.x, 0.)) - 2. * d)
                   + abs(dist(vUv + vec2(0., t.y)) + dist(vUv - vec2(0., t.y)) - 2. * d);
          float dl = abs(lum(vUv + vec2(t.x, 0.)) - lum(vUv - vec2(t.x, 0.))) + abs(lum(vUv + vec2(0., t.y)) - lum(vUv - vec2(0., t.y)));
          float e = max(smoothstep(.015, .05, dd / d), smoothstep(.12, .3, dl) * .8);
          c = mix(c, vec3(.16, .11, .09), e);
        }
        if (levels > .5) c = floor(c * levels + .5 + bayer(gl_FragCoord.xy) * .9 * dither) / levels;
        if (tonemap > .5) { vec2 v = vUv - .5; c *= 1. - dot(v, v) * .35; }   // 四角微暗
        gl_FragColor = vec4(c, 1.);
      }`,
  });
  const postScene = new THREE.Scene();
  const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post));

  // 畫布大小改變時：像素風格固定高度，全解析度風格跟著螢幕
  function resize(camera) {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const rh = FULL ? Math.round(h * Math.min(devicePixelRatio, 2)) : STYLE.h;
    const rw = Math.max(160, Math.round(rh * w / h));
    renderer.setSize(rw, rh, false);
    target.setSize(rw, rh);
    post.uniforms.texel.value.set(1 / rw, 1 / rh);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function render(scene, camera) {
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(postScene, postCam);
  }

  return { renderer, resize, render };
}
