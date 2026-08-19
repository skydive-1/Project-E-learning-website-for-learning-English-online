/**
 * PDF Selection Rectangles Clustering and Normalization Utility
 * TASK-PDF-SMART-NOTES-RECTS-HOTFIX-01
 *
 * Thuật toán gộp các DOMRect nhỏ từ Text Layer của PDF thành các hình chữ nhật theo từng dòng hiển thị,
 * loại bỏ rect rác, clamp trong phạm vi trang và chuẩn hóa tọa độ [0, 1].
 */

/**
 * Kiểm tra xem 2 rect có cùng một dòng hiển thị hay không dựa vào độ giao nhau trục Y
 * @param {Object} r1 - Rect 1 { top, bottom, height }
 * @param {Object} r2 - Rect 2 { top, bottom, height }
 * @returns {boolean}
 */
export function isSameLine(r1, r2) {
  const overlapY = Math.min(r1.bottom, r2.bottom) - Math.max(r1.top, r2.top);
  const minHeight = Math.min(r1.height, r2.height);
  if (minHeight <= 0) return false;

  // Nếu độ giao nhau theo chiều dọc >= 40% chiều cao của rect nhỏ hơn -> cùng dòng
  if (overlapY >= minHeight * 0.4) {
    return true;
  }

  // Hoặc khoảng cách giữa 2 tâm Y nhỏ hơn 45% chiều cao trung bình
  const center1Y = (r1.top + r1.bottom) / 2;
  const center2Y = (r2.top + r2.bottom) / 2;
  const avgHeight = (r1.height + r2.height) / 2;
  return Math.abs(center1Y - center2Y) <= avgHeight * 0.45;
}

/**
 * Gộp 2 rect thành một bounding box duy nhất
 */
export function mergeTwoRects(r1, r2) {
  const left = Math.min(r1.left, r2.left);
  const top = Math.min(r1.top, r2.top);
  const right = Math.max(r1.right, r2.right);
  const bottom = Math.max(r1.bottom, r2.bottom);
  return {
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top
  };
}

/**
 * Thu thập, lọc, sắp xếp, gộp theo dòng và chuẩn hóa danh sách ClientRects
 * @param {DOMRectList|Array} clientRects - Danh sách rects từ range.getClientRects()
 * @param {DOMRect|Object} pageRect - Kích thước và vị trí của trang PDF (.react-pdf__Page)
 * @returns {Array<{ x: number, y: number, width: number, height: number }>}
 */
export function mergePdfSelectionRects(clientRects, pageRect) {
  if (!clientRects || !pageRect) return [];
  const rectArray = Array.from(clientRects);
  if (rectArray.length === 0 || !pageRect.width || !pageRect.height || pageRect.width <= 0 || pageRect.height <= 0) {
    return [];
  }

  // 1. Lọc và Clamp từng rect vào giới hạn trang PDF (Page Bounds)
  const validRects = [];
  for (const r of rectArray) {
    if (
      !r ||
      !Number.isFinite(r.left) ||
      !Number.isFinite(r.top) ||
      !Number.isFinite(r.width) ||
      !Number.isFinite(r.height) ||
      r.width <= 0 ||
      r.height <= 0
    ) {
      continue;
    }

    const rRight = Number.isFinite(r.right) ? r.right : r.left + r.width;
    const rBottom = Number.isFinite(r.bottom) ? r.bottom : r.top + r.height;

    // Bỏ qua nếu rect nằm hoàn toàn ngoài trang
    if (
      rRight <= pageRect.left ||
      r.left >= pageRect.right ||
      rBottom <= pageRect.top ||
      r.top >= pageRect.bottom
    ) {
      continue;
    }

    // Clamp vào bên trong trang
    const left = Math.max(pageRect.left, Math.min(pageRect.right, r.left));
    const top = Math.max(pageRect.top, Math.min(pageRect.bottom, r.top));
    const right = Math.max(pageRect.left, Math.min(pageRect.right, rRight));
    const bottom = Math.max(pageRect.top, Math.min(pageRect.bottom, rBottom));

    const width = right - left;
    const height = bottom - top;

    // Loại bỏ rect rỗng sau khi clamp
    if (width > 0.1 && height > 0.1) {
      validRects.push({ left, top, right, bottom, width, height });
    }
  }

  if (validRects.length === 0) return [];

  // 2. Sắp xếp rect từ trên xuống dưới, từ trái sang phải
  validRects.sort((a, b) => {
    if (isSameLine(a, b)) {
      return a.left - b.left;
    }
    return a.top - b.top;
  });

  // 3. Gom cụm và gộp các rect trên cùng một dòng
  const lineClusters = [];
  for (const rect of validRects) {
    let merged = false;

    // Tìm xem rect có thể gộp vào dòng đang duyệt gần nhất không
    for (let i = lineClusters.length - 1; i >= 0; i--) {
      const cluster = lineClusters[i];
      if (isSameLine(cluster, rect)) {
        // Cho phép gộp nếu là cùng một dòng trong cùng đoạn bôi đen
        lineClusters[i] = mergeTwoRects(cluster, rect);
        merged = true;
        break;
      }
    }

    if (!merged) {
      lineClusters.push({ ...rect });
    }
  }

  // 4. Sắp xếp lại danh sách các dòng theo thứ tự từ trên xuống dưới
  lineClusters.sort((a, b) => a.top - b.top);

  // 5. Chuẩn hóa tọa độ tương đối theo tỷ lệ trang [0.0, 1.0]
  const normalizedRects = [];
  for (const line of lineClusters) {
    let normX = (line.left - pageRect.left) / pageRect.width;
    let normY = (line.top - pageRect.top) / pageRect.height;
    let normW = line.width / pageRect.width;
    let normH = line.height / pageRect.height;

    // Giới hạn trong khoảng [0, 1]
    normX = Math.max(0, Math.min(0.999, normX));
    normY = Math.max(0, Math.min(0.999, normY));
    normW = Math.max(0.001, Math.min(1 - normX, normW));
    normH = Math.max(0.001, Math.min(1 - normY, normH));

    // Làm tròn 4 chữ số thập phân
    let finalX = Number(normX.toFixed(4));
    let finalY = Number(normY.toFixed(4));
    let finalW = Number(normW.toFixed(4));
    let finalH = Number(normH.toFixed(4));

    // Đảm bảo không tràn viền: x + width <= 1 và y + height <= 1
    if (finalX + finalW > 1.0) {
      finalW = Number(Math.max(0.001, 1.0 - finalX).toFixed(4));
    }
    if (finalY + finalH > 1.0) {
      finalH = Number(Math.max(0.001, 1.0 - finalY).toFixed(4));
    }

    if (
      finalW > 0 &&
      finalH > 0 &&
      Number.isFinite(finalX) &&
      Number.isFinite(finalY) &&
      Number.isFinite(finalW) &&
      Number.isFinite(finalH)
    ) {
      normalizedRects.push({
        x: finalX,
        y: finalY,
        width: finalW,
        height: finalH
      });
    }
  }

  return normalizedRects;
}
