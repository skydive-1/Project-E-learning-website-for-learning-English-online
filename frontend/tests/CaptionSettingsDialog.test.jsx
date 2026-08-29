import React from 'react';
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CaptionSettingsDialog from '../src/modules/lessons/components/CaptionSettingsDialog';
import { DEFAULT_CAPTION_SETTINGS } from '../src/modules/lessons/utils/captionSettings';

afterEach(cleanup);

describe('CaptionSettingsDialog focus lifecycle', () => {
  it('focuses the dialog and restores focus to the CC trigger when the menu item is gone', async () => {
    const ccTrigger = document.createElement('button');
    const removedMenuItem = document.createElement('button');
    document.body.append(ccTrigger, removedMenuItem);
    removedMenuItem.focus();

    const returnFocusRef = { current: ccTrigger };
    const props = {
      value: { ...DEFAULT_CAPTION_SETTINGS },
      onChange: vi.fn(),
      onClose: vi.fn(),
      returnFocusRef
    };
    const { rerender, getByRole } = render(
      <CaptionSettingsDialog {...props} open />
    );

    await waitFor(() => {
      expect(getByRole('button', { name: 'Đóng tùy chỉnh phụ đề' })).toHaveFocus();
    });

    removedMenuItem.remove();
    rerender(<CaptionSettingsDialog {...props} open={false} />);

    await waitFor(() => expect(ccTrigger).toHaveFocus());
    ccTrigger.remove();
  });
});
