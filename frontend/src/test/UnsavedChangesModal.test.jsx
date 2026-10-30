import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/preact';
import { UnsavedChangesModal } from '../components/UnsavedChangesModal.jsx';

describe('UnsavedChangesModal Component', () => {
  it('renders correctly with UFABC theme', () => {
    render(
      <UnsavedChangesModal
        isOpen={true}
        theme="ufabc"
        onSave={() => {}}
        onDiscard={() => {}}
        onCancel={() => {}}
      />
    );

    expect(screen.getByText('Alterações Não Salvas')).toBeTruthy();
    expect(screen.getByText('🌿')).toBeTruthy();
    expect(screen.getByText(/Salvar Alterações e Sair/i)).toBeTruthy();
    expect(screen.getByText(/Descartar Alterações/i)).toBeTruthy();
  });

  it('renders correctly with Pride theme', () => {
    render(
      <UnsavedChangesModal
        isOpen={true}
        theme="pride"
        onSave={() => {}}
        onDiscard={() => {}}
        onCancel={() => {}}
      />
    );

    expect(screen.getByText('🏳️‍🌈')).toBeTruthy();
  });

  it('renders correctly with Halloween theme', () => {
    render(
      <UnsavedChangesModal
        isOpen={true}
        theme="halloween"
        onSave={() => {}}
        onDiscard={() => {}}
        onCancel={() => {}}
      />
    );

    expect(screen.getByText('🎃')).toBeTruthy();
  });

  it('triggers onSave, onDiscard and onCancel callbacks correctly', () => {
    const onSave = vi.fn();
    const onDiscard = vi.fn();
    const onCancel = vi.fn();

    render(
      <UnsavedChangesModal
        isOpen={true}
        theme="ufabc"
        onSave={onSave}
        onDiscard={onDiscard}
        onCancel={onCancel}
      />
    );

    fireEvent.click(screen.getByText(/Salvar Alterações e Sair/i));
    expect(onSave).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText(/Descartar Alterações/i));
    expect(onDiscard).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText(/Continuar Editando o Perfil/i));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape key press', () => {
    const onCancel = vi.fn();

    render(
      <UnsavedChangesModal
        isOpen={true}
        theme="ufabc"
        onSave={() => {}}
        onDiscard={() => {}}
        onCancel={onCancel}
      />
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
