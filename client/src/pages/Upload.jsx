import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { ErrorMsg, StatusBadge, SummaryCards } from '../components/Bits';

export default function Upload() {
  const qc = useQueryClient();
  const input = useRef(null);
  const [file, setFile] = useState(null);
  const [over, setOver] = useState(false);

  const upload = useMutation({
    mutationFn: (f) => {
      const form = new FormData();
      form.append('file', f);
      return api('/runs', { method: 'POST', form });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['runs'] }),
  });

  const pick = (f) => {
    if (!f) return;
    setFile(f);
    upload.reset();
  };

  return (
    <div className="card">
      <h1>Process a transaction file</h1>
      <p className="muted">Upload a transaction CSV. The whole file is processed in one go: it is fully applied or not at all.</p>
      <div
        className={`drop ${over ? 'over' : ''}`}
        onClick={() => input.current.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); pick(e.dataTransfer.files[0]); }}
      >
        <input ref={input} type="file" accept=".csv,text/csv" hidden onChange={(e) => pick(e.target.files[0])} />
        {file ? <strong>{file.name}</strong> : <span>Drop a CSV here, or click to choose</span>}
      </div>
      <button disabled={!file || upload.isPending} onClick={() => upload.mutate(file)}>
        {upload.isPending ? 'Processing...' : 'Process file'}
      </button>
      <ErrorMsg error={upload.error} />

      {upload.data && (
        <div className="result">
          <h2>
            Run #{upload.data.runId} <StatusBadge status={upload.data.status} />
          </h2>
          <p className="muted">{upload.data.sourceFile}</p>
          <SummaryCards summary={upload.data.summary} />
          <p><Link to={`/runs/${upload.data.runId}`}>View run details →</Link></p>
        </div>
      )}
    </div>
  );
}
