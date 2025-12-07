/**
 * FormFieldLayout Component
 * 
 * [ë¶ˆë? ê·œì¹™] ?¤í‚¤ë§ˆì—??Tailwind ?´ë˜?¤ë? ì§ì ‘ ?¬ìš©?˜ì? ?ŠìŠµ?ˆë‹¤.
 * [ë¶ˆë? ê·œì¹™] colSpan??propsë¡?ë°›ì•„ Grid ?ˆì´?„ì›ƒ??êµ¬ì„±?©ë‹ˆ??
 * [ë¶ˆë? ê·œì¹™] core-uiê°€ ?´ë??ìœ¼ë¡?Tailwind token classë¡?ë³€?˜í•©?ˆë‹¤.
 * 
 * ê¸°ìˆ ë¬¸ì„œ: docu/?¤í‚¤ë§ˆì—”ì§?txt 8. Renderer ?µí•©
 */

import React from 'react';
import { clsx } from 'clsx';

export interface FormFieldLayoutProps {
  children: React.ReactNode;
  colSpan?: number;  // Grid column span (1-12, ê¸°ë³¸ê°? 12)
  className?: string;
}

/**
 * FormFieldLayout ì»´í¬?ŒíŠ¸
 * 
 * ?¤í‚¤ë§??„ë“œ??colSpan??Grid ?ˆì´?„ì›ƒ?¼ë¡œ ë³€?˜í•©?ˆë‹¤.
 * 12-column grid ?œìŠ¤?œì„ ?¬ìš©?©ë‹ˆ??
 */
export const FormFieldLayout: React.FC<FormFieldLayoutProps> = ({
  children,
  colSpan = 12,
  className,
}) => {
  // colSpan??1-12 ë²”ìœ„ë¡??œí•œ
  const normalizedColSpan = Math.max(1, Math.min(12, colSpan));
  
  // Grid column span ê³„ì‚° (12-column grid ê¸°ì?)
  const gridColumnSpan = `${normalizedColSpan} / span ${normalizedColSpan}`;

  return (
    <div
      className={clsx(className)}
      style={{
        gridColumn: gridColumnSpan,
        width: '100%',
      }}
    >
      {children}
    </div>
  );
};

