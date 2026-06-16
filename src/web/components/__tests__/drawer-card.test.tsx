// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { DrawerCard } from '../drawer-card.js';

afterEach(cleanup);

describe('DrawerCard', () => {
  it('lets a collapsed card with children and no summary expand from the header', () => {
    render(
      <DrawerCard header={<span>Expandable header</span>}>
        <p>Drawer body</p>
      </DrawerCard>,
    );

    const toggle = screen.getByRole('button', { name: 'Expandable header' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('Drawer body')).toBeNull();

    fireEvent.click(toggle);

    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Drawer body')).toBeTruthy();
  });

  it('treats falsy ReactNode values as present drawer content', () => {
    render(<DrawerCard header={<span>Zero child</span>}>{0}</DrawerCard>);

    const toggle = screen.getByRole('button', { name: 'Zero child' });
    fireEvent.click(toggle);

    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('0')).toBeTruthy();
  });

  it('treats an empty-string summary as present disclosure content', () => {
    const { container } = render(
      <DrawerCard header={<span>Empty summary</span>} summary="">
        Full drawer
      </DrawerCard>,
    );

    const toggle = screen.getByRole('button', { name: 'Empty summary' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('[data-drawer-card-content]')).toBeTruthy();
    expect(screen.queryByText('Full drawer')).toBeNull();
  });
});
