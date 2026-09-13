import { Box, Button, Chip, Paper, Stack, Typography } from '@mui/material';
import { useCallback, useState, type DragEvent, type ChangeEvent } from 'react';

type Props = {
  file: File | undefined;
  onFileSelect: (file: File | undefined) => void;
  disabled?: boolean;
  accept?: string;
  maxSizeBytes?: number;
};

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};

export const FileDropzone = ({
  file,
  onFileSelect,
  disabled = false,
  accept = 'application/pdf,image/jpeg,image/png',
  maxSizeBytes = 5 * 1024 * 1024,
}: Props) => {
  const [isDragging, setIsDragging] = useState(false);
  const [sizeError, setSizeError] = useState<string>();

  const handleFile = useCallback(
    (selectedFile: File | undefined) => {
      setSizeError(undefined);
      if (!selectedFile) {
        onFileSelect(undefined);
        return;
      }
      if (maxSizeBytes && selectedFile.size > maxSizeBytes) {
        setSizeError(
          `File size (${formatBytes(selectedFile.size)}) exceeds the maximum allowed limit of ${formatBytes(maxSizeBytes)}.`,
        );
        onFileSelect(undefined);
        return;
      }
      onFileSelect(selectedFile);
    },
    [maxSizeBytes, onFileSelect],
  );

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled) return;

    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      handleFile(droppedFile);
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    handleFile(selectedFile);
  };

  return (
    <Stack spacing={1}>
      <Paper
        variant="outlined"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        sx={{
          p: 3,
          textAlign: 'center',
          cursor: disabled ? 'not-allowed' : 'pointer',
          borderStyle: 'dashed',
          borderWidth: 2,
          borderColor: isDragging ? 'primary.main' : 'divider',
          bgcolor: isDragging ? 'action.hover' : 'background.paper',
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            borderColor: disabled ? 'divider' : 'primary.main',
            bgcolor: disabled ? 'background.paper' : 'action.hover',
          },
        }}
      >
        <input
          hidden
          id="synthetic-file-dropzone-input"
          type="file"
          accept={accept}
          disabled={disabled}
          onChange={handleInputChange}
        />

        {file ? (
          <Stack spacing={1.5} sx={{ alignItems: 'center' }}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                bgcolor: 'primary.light',
                color: 'primary.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                fontSize: '1.2rem',
              }}
            >
              📄
            </Box>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, wordBreak: 'break-word' }}>
                {file.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatBytes(file.size)} · {file.type || 'Document'}
              </Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              <Chip label="Selected" color="success" size="small" variant="outlined" />
              <Button
                size="small"
                color="error"
                disabled={disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  handleFile(undefined);
                }}
              >
                Remove
              </Button>
            </Stack>
          </Stack>
        ) : (
          <label
            htmlFor="synthetic-file-dropzone-input"
            style={{
              cursor: disabled ? 'not-allowed' : 'pointer',
              width: '100%',
              display: 'block',
            }}
          >
            <Stack spacing={1} sx={{ alignItems: 'center' }}>
              <Box sx={{ fontSize: '2.5rem', lineHeight: 1 }}>📁</Box>
              <Typography variant="body1" sx={{ fontWeight: 600 }}>
                {isDragging
                  ? 'Drop synthetic document here'
                  : 'Drag & drop synthetic document here'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                or click to browse from your computer
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                Supports PDF, JPEG, PNG (max 5 MiB)
              </Typography>
            </Stack>
          </label>
        )}
      </Paper>

      {sizeError && (
        <Typography variant="caption" color="error" sx={{ px: 1 }}>
          {sizeError}
        </Typography>
      )}
    </Stack>
  );
};
