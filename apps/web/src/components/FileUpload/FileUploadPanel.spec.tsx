import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FileUploadPanel from './FileUploadPanel';

function createMockFile(name: string, type: string, size = 1024): File {
  const file = new File(['x'.repeat(size)], name, { type });
  return file;
}

describe('FileUploadPanel', () => {
  const onUpload = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render attach file button', () => {
    render(<FileUploadPanel onUpload={onUpload} />);
    const button = screen.getByTitle('Attach files');
    expect(button).toBeInTheDocument();
  });

  it('should show preview area after selecting a file', () => {
    render(<FileUploadPanel onUpload={onUpload} />);

    const fileInput = screen.getByTestId('file-input') as HTMLInputElement;
    // File input is hidden, so we need to trigger it directly
    const file = createMockFile('test.png', 'image/png');
    Object.defineProperty(fileInput, 'files', { value: [file] });
    fireEvent.change(fileInput);

    expect(screen.getByText('Send 1 file')).toBeInTheDocument();
  });

  it('should show "Send X files" with correct count', () => {
    render(<FileUploadPanel onUpload={onUpload} />);

    const fileInput = screen.getByTestId('file-input') as HTMLInputElement;
    const files = [
      createMockFile('a.png', 'image/png'),
      createMockFile('b.pdf', 'application/pdf'),
    ];
    Object.defineProperty(fileInput, 'files', { value: files });
    fireEvent.change(fileInput);

    expect(screen.getByText('Send 2 files')).toBeInTheDocument();
  });

  it('should call onUpload and clear previews on send', () => {
    render(<FileUploadPanel onUpload={onUpload} />);

    const fileInput = screen.getByTestId('file-input') as HTMLInputElement;
    const file = createMockFile('doc.txt', 'text/plain');
    Object.defineProperty(fileInput, 'files', { value: [file] });
    fireEvent.change(fileInput);

    const sendButton = screen.getByText('Send 1 file');
    fireEvent.click(sendButton);

    expect(onUpload).toHaveBeenCalledWith([file]);
    expect(screen.queryByText('Send 1 file')).not.toBeInTheDocument();
  });

  it('should show "Add more" button when previews exist', () => {
    render(<FileUploadPanel onUpload={onUpload} />);

    const fileInput = screen.getByTestId('file-input') as HTMLInputElement;
    Object.defineProperty(fileInput, 'files', { value: [createMockFile('img.jpg', 'image/jpeg')] });
    fireEvent.change(fileInput);

    expect(screen.getByText('Add more')).toBeInTheDocument();
  });

  it('should render disabled state', () => {
    render(<FileUploadPanel onUpload={onUpload} disabled />);

    const fileInput = screen.getByTestId('file-input') as HTMLInputElement;
    expect(fileInput.disabled).toBe(true);
  });
});
