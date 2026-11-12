# aliaogoogle
巴福柔照護任務

## 目前進度

- 畫面風格為「精緻像素」（另有 `?style=retro`、`toon`、`soft` 可比較）
- 客廳、走廊、狗房、廁所與廚房的 3D 模型（依照片與手繪平面圖估計尺寸），可切換俯瞰／人／狗／貓視角，左上角可切換房間
- 任務一「帶狗出門」：屋內三個步驟在 `js/mission.js`，出門後依序顯示的街景照片與說明文字在 `js/walk.js`，街景照片放 `assets/walk/`

## 本機預覽

純靜態網頁，不需要建置。因為使用 ES module，需透過本機伺服器開啟：

```bash
python3 -m http.server 8000
```

然後開啟 http://localhost:8000
