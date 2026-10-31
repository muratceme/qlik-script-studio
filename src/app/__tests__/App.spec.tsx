import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@/i18n';
import { App } from '@/app/App';
import { resetHistory, useProjectStore } from '@/store/projectStore';
import { useUiStore } from '@/store/uiStore';
import { newProject } from '@/model/defaults';

const realNow = Date.now;

// jsdom lacks these browser APIs used by CodeMirror, React Flow and <dialog>.
beforeEach(() => {
  localStorage.clear();
  // Each store write happens in a new "second" so the undo throttle records all of them.
  let now = realNow();
  vi.spyOn(Date, 'now').mockImplementation(() => (now += 1000));
  useProjectStore.getState().replaceProject(newProject());
  resetHistory();
  useUiStore.setState({ activeTab: 'builder', step: 1, language: 'en', theme: 'light' });
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: vi.fn() });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: vi.fn() });
  document.createRange = () => {
    const range = new Range();
    range.getBoundingClientRect = () => ({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      toJSON: () => ({}),
    });
    range.getClientRects = () =>
      ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] }) as unknown as DOMRectList;
    return range;
  };
});

describe('App', () => {
  it('shows the empty state and the validation error for an empty project', () => {
    render(<App />);
    expect(screen.getByText('No source tables yet')).toBeInTheDocument();
    expect(screen.getByText('The project has no source tables.')).toBeInTheDocument();
  });

  it('loads the sample project and shows its tables', () => {
    render(<App />);
    fireEvent.click(screen.getAllByRole('button', { name: /Load sample project/i })[0]!);
    const list = screen.getByRole('listbox', { name: 'Source tables' });
    expect(within(list).getByText('Sales')).toBeInTheDocument();
    expect(within(list).getByText('Customers')).toBeInTheDocument();
    expect(useProjectStore.getState().project.name).toBe('Sales demo');
    expect(screen.queryByText('The model has errors')).not.toBeInTheDocument();
  });

  it('switches the interface language to Turkish and back', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Language: EN/i }));
    expect(screen.getByRole('tab', { name: 'Model oluşturucu' })).toBeInTheDocument();
    expect(screen.getByText('Projede kaynak tablo yok.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Dil: TR/i }));
    expect(screen.getByRole('tab', { name: 'Model builder' })).toBeInTheDocument();
  });

  it('adds a table and undoes it', () => {
    render(<App />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Add table' })[0]!);
    expect(useProjectStore.getState().project.sources).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(useProjectStore.getState().project.sources).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Redo' }));
    expect(useProjectStore.getState().project.sources).toHaveLength(1);
  });
});
