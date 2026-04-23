import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage } from './LoginPage';

const signInMock = vi.fn();
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: (args: unknown) => signInMock(args),
    },
  },
}));

describe('LoginPage', () => {
  it('submits email and password', async () => {
    signInMock.mockResolvedValueOnce({ error: null });
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );
    fireEvent.change(screen.getByLabelText(/이메일/i), {
      target: { value: 'a@b.com' },
    });
    fireEvent.change(screen.getByLabelText(/비밀번호/i), {
      target: { value: 'pw1234' },
    });
    fireEvent.click(screen.getByRole('button', { name: /로그인/i }));
    await waitFor(() =>
      expect(signInMock).toHaveBeenCalledWith({ email: 'a@b.com', password: 'pw1234' })
    );
  });

  it('shows error on failure', async () => {
    signInMock.mockResolvedValueOnce({ error: { message: 'Invalid login credentials' } });
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );
    fireEvent.change(screen.getByLabelText(/이메일/i), {
      target: { value: 'a@b.com' },
    });
    fireEvent.change(screen.getByLabelText(/비밀번호/i), {
      target: { value: 'wrong' },
    });
    fireEvent.click(screen.getByRole('button', { name: /로그인/i }));
    await waitFor(() =>
      expect(screen.getByText(/Invalid login credentials/i)).toBeInTheDocument()
    );
  });
});
