import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

$(() => {
  // 注入 CSS：隐藏酒馆楼层（保留 DOM 供 MVU/插件使用）
  const $hideStyle = $('<style>')
    .attr('data-script-id', getScriptId())
    .text(`
      #chat { position: relative !important; min-height: 60vh; }
      #chat .mes { display: none !important; }
    `)
    .appendTo('head');

  let styleDestroy: (() => void) | undefined;

  const $iframe = createScriptIdIframe()
    .css({
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      border: 'none',
      zIndex: 10,
    })
    .appendTo('#chat')
    .on('load', function (this: HTMLIFrameElement) {
      const iframeDoc = this.contentDocument!;
      const iframeWin = this.contentWindow;
      styleDestroy = teleportStyle(iframeDoc.head).destroy;

      // 标记脚本模式 + 注入全屏控制函数
      // App.tsx 据此区分全屏策略，并直接调用 __setFullscreen__ 而非 postMessage
      if (iframeWin) {
        (iframeWin as any).__TAVERN_SCRIPT_MODE__ = true;
        (iframeWin as any).__setFullscreen__ = (fs: boolean) => {
          if (fs) {
            $iframe.css({
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              zIndex: 9999,
            });
            // 不再锁定横屏，保持竖屏
          } else {
            $iframe.css({
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              zIndex: 10,
            });
          }
        };
      }

      const rootDiv = iframeDoc.createElement('div');
      rootDiv.id = 'root';
      rootDiv.style.width = '100%';
      rootDiv.style.height = '100%';
      iframeDoc.body.appendChild(rootDiv);

      createRoot(rootDiv).render(<App />);
    });

  // 卸载时清理
  $(window).on('pagehide', () => {
    styleDestroy?.();
    $iframe.remove();
    $hideStyle.remove();
  });
});