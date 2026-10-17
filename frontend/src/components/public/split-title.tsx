import { Fragment } from "react";
import "./public.css";

/**
 * Tiêu đề hiện từng từ (giống SplitWords của hệ chung) nhưng đọc được đúng với trình đọc màn hình:
 * bản chữ đầy đủ nằm trong phần sr-only, các từ trang trí bị ẩn (aria-label trên thẻ span không có vai trò là không hợp lệ).
 * Khoảng trắng đặt giữa các khối từ, không để cuối khối inline-block vì trình duyệt sẽ bỏ khoảng trắng đó.
 */
export function SplitTitle({ text, className = "", startDelay = 0 }: { text: string; className?: string; startDelay?: number }) {
  const words = text.split(" ");
  return (
    <span className={className}>
      <span className="sr-only">{text} </span>
      <span aria-hidden="true">
        {words.map((word, i) => (
          <Fragment key={`${word}-${i}`}>
            <span className="inline-block overflow-hidden pb-[0.08em] align-bottom">
              <span className="anim-word" style={{ animationDelay: `${startDelay + i * 70}ms` }}>
                {word}
              </span>
            </span>
            {i < words.length - 1 ? " " : null}
          </Fragment>
        ))}
      </span>
    </span>
  );
}
