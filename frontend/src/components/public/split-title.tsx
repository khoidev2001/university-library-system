import "./public.css";

/**
 * Tiêu đề hiện từng từ (giống SplitWords của hệ chung) nhưng đọc được đúng với trình đọc màn hình:
 * bản chữ đầy đủ nằm trong phần sr-only, các từ trang trí bị ẩn (aria-label trên thẻ span không có vai trò là không hợp lệ).
 */
export function SplitTitle({ text, className = "", startDelay = 0 }: { text: string; className?: string; startDelay?: number }) {
  const words = text.split(" ");
  return (
    <span className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {words.map((word, i) => (
          <span key={`${word}-${i}`} className="inline-block overflow-hidden pb-[0.08em] align-bottom">
            <span className="anim-word" style={{ animationDelay: `${startDelay + i * 70}ms` }}>
              {word}
              {i < words.length - 1 ? " " : ""}
            </span>
          </span>
        ))}
      </span>
    </span>
  );
}
