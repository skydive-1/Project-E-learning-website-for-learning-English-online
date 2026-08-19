import { describe, it, expect } from 'vitest';
import { mergePdfSelectionRects, isSameLine, mergeTwoRects } from '../src/modules/lessons/utils/pdfSelectionRects';

describe('=== TASK-PDF-SMART-NOTES-RECTS-HOTFIX-01: PDF Selection Rects Utility Test Suite ===', () => {
  const mockPageRect = {
    left: 100,
    top: 50,
    right: 700,
    bottom: 850,
    width: 600,
    height: 800
  };

  // =========================================================================
  // 1. UNIT FUNCTIONS (isSameLine, mergeTwoRects)
  // =========================================================================
  describe('1. Primitive Functions (isSameLine & mergeTwoRects)', () => {
    it('1.1 isSameLine should return true for rects on the same horizontal line with vertical overlap', () => {
      const r1 = { top: 100, bottom: 120, height: 20, left: 100, right: 150 };
      const r2 = { top: 102, bottom: 122, height: 20, left: 155, right: 200 };
      expect(isSameLine(r1, r2)).toBe(true);
    });

    it('1.2 isSameLine should return false for rects on different lines', () => {
      const line1 = { top: 100, bottom: 120, height: 20, left: 100, right: 200 };
      const line2 = { top: 130, bottom: 150, height: 20, left: 100, right: 200 };
      expect(isSameLine(line1, line2)).toBe(false);
    });

    it('1.3 mergeTwoRects should return bounding box of both rects', () => {
      const r1 = { left: 100, top: 100, right: 150, bottom: 120 };
      const r2 = { left: 140, top: 102, right: 220, bottom: 122 };
      const merged = mergeTwoRects(r1, r2);
      expect(merged).toEqual({
        left: 100,
        top: 100,
        right: 220,
        bottom: 122,
        width: 120,
        height: 22
      });
    });
  });

  // =========================================================================
  // 2. MERGING ALGORITHM & CASE VERIFICATION
  // =========================================================================
  describe('2. mergePdfSelectionRects Core Scenarios', () => {
    it('2.1 should merge 60 tiny rects on the same line into exactly 1 normalized rect', () => {
      const tinyRects = [];
      // 60 rects representing 60 characters/spans on line Y=100..120
      for (let i = 0; i < 60; i++) {
        tinyRects.push({
          left: 120 + i * 8,
          top: 100,
          right: 120 + (i + 1) * 8,
          bottom: 120,
          width: 8,
          height: 20
        });
      }

      const result = mergePdfSelectionRects(tinyRects, mockPageRect);
      expect(result).toHaveLength(1);

      const merged = result[0];
      // Expected normalized values:
      // left = 120, right = 120 + 60*8 = 600
      // x = (120 - 100) / 600 = 20 / 600 = 0.0333
      // y = (100 - 50) / 800 = 50 / 800 = 0.0625
      // width = 480 / 600 = 0.8
      // height = 20 / 800 = 0.025
      expect(merged.x).toBeCloseTo(0.0333, 3);
      expect(merged.y).toBeCloseTo(0.0625, 3);
      expect(merged.width).toBeCloseTo(0.8, 3);
      expect(merged.height).toBeCloseTo(0.025, 3);
      expect(merged.x + merged.width).toBeLessThanOrEqual(1.0);
      expect(merged.y + merged.height).toBeLessThanOrEqual(1.0);
    });

    it('2.2 should merge 120 rects across 3 lines into exactly 3 normalized rects', () => {
      const multiLineRects = [];
      // Line 1: 40 rects at Y=100
      for (let i = 0; i < 40; i++) {
        multiLineRects.push({
          left: 150 + i * 10,
          top: 100,
          right: 150 + (i + 1) * 10,
          bottom: 120,
          width: 10,
          height: 20
        });
      }
      // Line 2: 40 rects at Y=130
      for (let i = 0; i < 40; i++) {
        multiLineRects.push({
          left: 150 + i * 10,
          top: 130,
          right: 150 + (i + 1) * 10,
          bottom: 150,
          width: 10,
          height: 20
        });
      }
      // Line 3: 40 rects at Y=160
      for (let i = 0; i < 40; i++) {
        multiLineRects.push({
          left: 150 + i * 10,
          top: 160,
          right: 150 + (i + 1) * 10,
          bottom: 180,
          width: 10,
          height: 20
        });
      }

      const result = mergePdfSelectionRects(multiLineRects, mockPageRect);
      expect(result).toHaveLength(3);

      // Verify that the lines maintain vertical order
      expect(result[0].y).toBeLessThan(result[1].y);
      expect(result[1].y).toBeLessThan(result[2].y);

      result.forEach((rect) => {
        expect(rect.x).toBeGreaterThanOrEqual(0);
        expect(rect.y).toBeGreaterThanOrEqual(0);
        expect(rect.width).toBeGreaterThan(0);
        expect(rect.height).toBeGreaterThan(0);
        expect(rect.x + rect.width).toBeLessThanOrEqual(1.0);
        expect(rect.y + rect.height).toBeLessThanOrEqual(1.0);
      });
    });

    it('2.3 rects on different lines must NOT be mistakenly merged into one line', () => {
      const distinctLines = [
        { left: 120, top: 100, right: 300, bottom: 120, width: 180, height: 20 },
        { left: 120, top: 150, right: 300, bottom: 170, width: 180, height: 20 }
      ];

      const result = mergePdfSelectionRects(distinctLines, mockPageRect);
      expect(result).toHaveLength(2);
      expect(result[0].y).not.toEqual(result[1].y);
    });

    it('2.4 overlapping and adjacent rects on the same line are merged cleanly', () => {
      const overlapping = [
        { left: 100, top: 100, right: 180, bottom: 120, width: 80, height: 20 },
        { left: 150, top: 100, right: 250, bottom: 120, width: 100, height: 20 },
        { left: 240, top: 100, right: 320, bottom: 120, width: 80, height: 20 }
      ];

      const result = mergePdfSelectionRects(overlapping, mockPageRect);
      expect(result).toHaveLength(1);
      // Normalized left should be (100 - 100)/600 = 0
      expect(result[0].x).toBe(0);
      // Normalized right should be (320 - 100)/600 = 220/600 = 0.3667
      expect(result[0].width).toBeCloseTo(0.3667, 3);
    });

    it('2.5 rects partially outside page boundaries must be properly clamped', () => {
      const outOfBounds = [
        // Left extends before page (left = 50 < pageRect.left = 100)
        { left: 50, top: 100, right: 200, bottom: 120, width: 150, height: 20 },
        // Right extends beyond page (right = 750 > pageRect.right = 700)
        { left: 600, top: 150, right: 750, bottom: 170, width: 150, height: 20 }
      ];

      const result = mergePdfSelectionRects(outOfBounds, mockPageRect);
      expect(result).toHaveLength(2);

      // First rect left should clamp to 0
      expect(result[0].x).toBe(0);
      // Second rect right should clamp to 1.0 (x + width <= 1.0)
      expect(result[1].x + result[1].width).toBeLessThanOrEqual(1.0001);
    });

    it('2.6 handles empty or invalid input safely and returns empty array', () => {
      expect(mergePdfSelectionRects(null, mockPageRect)).toEqual([]);
      expect(mergePdfSelectionRects([], mockPageRect)).toEqual([]);
      expect(mergePdfSelectionRects([{ left: NaN, top: 100, width: 20, height: 20 }], mockPageRect)).toEqual([]);
      expect(mergePdfSelectionRects([{ left: 100, top: 100, width: 0, height: 0 }], mockPageRect)).toEqual([]);
      expect(mergePdfSelectionRects([{ left: 100, top: 100, width: 50, height: 20 }], null)).toEqual([]);
      expect(mergePdfSelectionRects([{ left: 100, top: 100, width: 50, height: 20 }], { width: 0, height: 0 })).toEqual([]);
    });

    it('2.7 rect completely outside page boundary is discarded', () => {
      const completelyOutside = [
        { left: 800, top: 900, right: 900, bottom: 950, width: 100, height: 50 }
      ];
      expect(mergePdfSelectionRects(completelyOutside, mockPageRect)).toEqual([]);
    });
  });
});
