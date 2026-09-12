import { Button, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import type { ClaimCase, ClaimFieldName, ReviewCaseInput } from '@claimflow/domain';

export function MissingFieldForm({
  claim,
  busy,
  onCorrect,
}: {
  claim: ClaimCase;
  busy: boolean;
  onCorrect: (
    field: ClaimFieldName,
    value: string,
    evidence: NonNullable<ReviewCaseInput['evidence']>,
  ) => Promise<void>;
}) {
  const missing = [
    ...new Set(
      claim.issues
        .filter((issue) => issue.status === 'OPEN' && issue.type === 'MISSING_REQUIRED_FIELD')
        .flatMap((issue) => issue.fieldNames),
    ),
  ].filter((name) => !claim.fields.some((field) => field.name === name));
  const [name, setName] = useState<ClaimFieldName | ''>('');
  const [value, setValue] = useState('');
  const [documentId, setDocumentId] = useState(claim.documents[0]?.id ?? '');
  useEffect(() => {
    if (!claim.documents.some((document) => document.id === documentId))
      setDocumentId(claim.documents[0]?.id ?? '');
  }, [claim.documents, documentId]);
  const [page, setPage] = useState(1);
  const [excerpt, setExcerpt] = useState('');
  const field = missing.includes(name as ClaimFieldName) ? (name as ClaimFieldName) : missing[0];
  if (!field || claim.status === 'DRAFT' || claim.status === 'PROCESSING') return null;
  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Stack spacing={2}>
        <Typography variant="h6">Supply a missing value from evidence</Typography>
        <TextField
          select
          label="Missing field"
          value={field}
          onChange={(event) => setName(event.target.value as ClaimFieldName)}
        >
          {missing.map((item) => (
            <MenuItem key={item} value={item}>
              {item}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="Supported value"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
        <TextField
          select
          label="Source document"
          value={documentId}
          onChange={(event) => setDocumentId(event.target.value)}
        >
          {claim.documents.map((document) => (
            <MenuItem key={document.id} value={document.id}>
              {document.filename}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          type="number"
          label="Page (1 for an image)"
          value={page}
          onChange={(event) => setPage(Number(event.target.value))}
        />
        <TextField
          label="Supporting excerpt from the source"
          multiline
          value={excerpt}
          onChange={(event) => setExcerpt(event.target.value)}
        />
        <Button
          variant="contained"
          disabled={
            busy ||
            !value.trim() ||
            !documentId ||
            !excerpt.trim() ||
            !Number.isInteger(page) ||
            page < 1
          }
          onClick={() => onCorrect(field, value, { documentId, page, excerpt })}
        >
          Save evidence-backed correction
        </Button>
      </Stack>
    </Paper>
  );
}
