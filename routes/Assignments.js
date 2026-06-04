import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/Layout/AppLayout';
import { useAuth } from '../../context/AuthContext';
import Editor from '@monaco-editor/react';

const LANG_COLOR = { c:'#3b82f6', cpp:'#6366f1', python:'#f59e0b', java:'#f97316', javascript:'#eab308' };
const LANG_ICON  = { c:'🔵', cpp:'🟣', python:'🟡', java:'🟠', javascript:'🟨' };
const STARTERS = {
  c:'#include <stdio.h>\n\nint main() {\n    // Write your solution here\n    return 0;\n}',
  cpp:'#include <iostream>\nusing namespace std;\nint main() {\n    // Write your solution here\n    return 0;\n}',
  python:'# Write your solution here\n',
  java:'public class Main {\n    public static void main(String[] args) {\n        // Write your solution here\n    }\n}',
  javascript:'// Write your solution here\n',
};

export default function TutorAssignments() {
  const { API } = useAuth();
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [showCreate,  setShowCreate]  = useState(false);
  const [showEdit,    setShowEdit]    = useState(null);
  const [showSubs,    setShowSubs]    = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [saving,      setSaving]      = useState(false);

  const blank = { title:'', description:'', language:'c', starterCode:STARTERS.c, deadline:'', testCases:[{ input:'', expectedOutput:'', label:'Test 1', isHidden:false }] };
  const [form, setForm] = useState(blank);

  useEffect(() => {
    API.get('/assignments/my').then(r => setAssignments(r.data)).finally(() => setLoading(false));
  }, [API]);

  const addTestCase = () => setForm(f => ({ ...f, testCases:[...f.testCases, { input:'', expectedOutput:'', label:`Test ${f.testCases.length+1}`, isHidden:false }] }));
  const removeTestCase = (i) => setForm(f => ({ ...f, testCases: f.testCases.filter((_,idx)=>idx!==i) }));
  const updateTC = (i, field, val) => setForm(f => ({ ...f, testCases: f.testCases.map((tc,idx)=>idx===i?{...tc,[field]:val}:tc) }));

  const saveAssignment = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      if (showEdit) {
        const res = await API.patch(`/assignments/${showEdit._id}`, form);
        setAssignments(a => a.map(x => x._id===showEdit._id ? res.data : x));
        setShowEdit(null);
      } else {
        const res = await API.post('/assignments', form);
        setAssignments(a => [res.data, ...a]);
        setShowCreate(false);
      }
      setForm(blank);
    } catch(e) { alert(e.response?.data?.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  const deleteAssignment = async (id) => {
    if (!window.confirm('Delete this assignment?')) return;
    await API.delete(`/assignments/${id}`);
    setAssignments(a => a.filter(x => x._id !== id));
  };

  const viewSubmissions = async (id) => {
    const res = await API.get(`/assignments/${id}/submissions`);
    setSubmissions(res.data); setShowSubs(id);
  };

  const formModal = (title) => (
    <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'flex-start',justifyContent:'center',zIndex:2000,overflowY:'auto',padding:'20px 0' }}>
      <div style={{ background:'#1a2035',borderRadius:14,padding:28,width:'min(680px,95vw)',boxShadow:'0 20px 60px rgba(0,0,0,0.5)',border:'1px solid #2a3554',position:'relative' }} onClick={e=>e.stopPropagation()}>
        <button onClick={()=>{setShowCreate(false);setShowEdit(null);setForm(blank);}} style={{ position:'absolute',top:14,right:16,background:'none',border:'none',fontSize:20,cursor:'pointer',color:'#64748b' }}>✕</button>
        <h2 style={{ fontSize:17,fontWeight:700,color:'#e2e8f0',marginBottom:20 }}>{title}</h2>
        <form onSubmit={saveAssignment} style={{ display:'flex',flexDirection:'column',gap:16 }}>
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }}>
            <div>
              <label style={{ fontSize:12,fontWeight:600,color:'#94a3b8',display:'block',marginBottom:5 }}>Title *</label>
              <input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} required
                style={{ width:'100%',padding:'8px 12px',borderRadius:7,border:'1px solid #2a3554',background:'#0f1117',color:'#e2e8f0',fontSize:13,outline:'none',boxSizing:'border-box' }}/>
            </div>
            <div>
              <label style={{ fontSize:12,fontWeight:600,color:'#94a3b8',display:'block',marginBottom:5 }}>Language</label>
              <select value={form.language} onChange={e=>setForm(f=>({...f,language:e.target.value,starterCode:STARTERS[e.target.value]}))}
                style={{ width:'100%',padding:'8px 12px',borderRadius:7,border:'1px solid #2a3554',background:'#0f1117',color:'#e2e8f0',fontSize:13,outline:'none' }}>
                <option value="c">🔵 C</option><option value="cpp">🟣 C++</option>
                <option value="python">🟡 Python</option><option value="java">🟠 Java</option>
                <option value="javascript">🟨 JavaScript</option>
              </select>
            </div>
          </div>
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }}>
            <div>
              <label style={{ fontSize:12,fontWeight:600,color:'#94a3b8',display:'block',marginBottom:5 }}>Description</label>
              <textarea value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} rows={3}
                style={{ width:'100%',padding:'8px 12px',borderRadius:7,border:'1px solid #2a3554',background:'#0f1117',color:'#e2e8f0',fontSize:12,resize:'none',outline:'none',boxSizing:'border-box' }}/>
            </div>
            <div>
              <label style={{ fontSize:12,fontWeight:600,color:'#94a3b8',display:'block',marginBottom:5 }}>Deadline</label>
              <input type="datetime-local" value={form.deadline} onChange={e=>setForm(f=>({...f,deadline:e.target.value}))}
                style={{ width:'100%',padding:'8px 12px',borderRadius:7,border:'1px solid #2a3554',background:'#0f1117',color:'#e2e8f0',fontSize:13,outline:'none',boxSizing:'border-box' }}/>
            </div>
          </div>
          <div>
            <label style={{ fontSize:12,fontWeight:600,color:'#94a3b8',display:'block',marginBottom:5 }}>Starter Code</label>
            <div style={{ height:160,border:'1px solid #2a3554',borderRadius:7,overflow:'hidden' }}>
              <Editor height="160px" language={form.language==='cpp'?'cpp':form.language} value={form.starterCode}
                onChange={v=>setForm(f=>({...f,starterCode:v||''}))} theme="vs-dark"
                options={{ fontSize:12,minimap:{enabled:false},scrollBeyondLastLine:false,padding:{top:8} }}/>
            </div>
          </div>
          <div>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8 }}>
              <label style={{ fontSize:12,fontWeight:600,color:'#94a3b8' }}>Test Cases</label>
              <button type="button" onClick={addTestCase} style={{ padding:'3px 10px',borderRadius:6,border:'1px solid rgba(59,130,246,0.4)',background:'rgba(59,130,246,0.1)',color:'#3b82f6',fontSize:11,fontWeight:600,cursor:'pointer' }}>＋ Add Test</button>
            </div>
            <div style={{ display:'flex',flexDirection:'column',gap:8,maxHeight:240,overflowY:'auto' }}>
              {form.testCases.map((tc,i)=>(
                <div key={i} style={{ background:'#0f1117',border:'1px solid #2a3554',borderRadius:8,padding:'10px 12px' }}>
                  <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8 }}>
                    <input value={tc.label} onChange={e=>updateTC(i,'label',e.target.value)} placeholder="Label"
                      style={{ padding:'4px 8px',borderRadius:5,border:'1px solid #2a3554',background:'#1a2035',color:'#e2e8f0',fontSize:11,outline:'none',width:120 }}/>
                    <div style={{ display:'flex',gap:8,alignItems:'center' }}>
                      <label style={{ display:'flex',alignItems:'center',gap:4,fontSize:11,color:'#94a3b8',cursor:'pointer' }}>
                        <input type="checkbox" checked={tc.isHidden} onChange={e=>updateTC(i,'isHidden',e.target.checked)}/> Hidden
                      </label>
                      {form.testCases.length>1&&<button type="button" onClick={()=>removeTestCase(i)} style={{ background:'none',border:'none',color:'#ef4444',cursor:'pointer',fontSize:13 }}>✕</button>}
                    </div>
                  </div>
                  <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:8 }}>
                    <div>
                      <div style={{ fontSize:10,color:'#64748b',marginBottom:3 }}>Input (stdin)</div>
                      <textarea value={tc.input} onChange={e=>updateTC(i,'input',e.target.value)} rows={2} placeholder="Leave empty if no input"
                        style={{ width:'100%',padding:'5px 8px',borderRadius:5,border:'1px solid #2a3554',background:'#1a2035',color:'#e2e8f0',fontSize:11,fontFamily:'monospace',resize:'none',outline:'none',boxSizing:'border-box' }}/>
                    </div>
                    <div>
                      <div style={{ fontSize:10,color:'#64748b',marginBottom:3 }}>Expected Output *</div>
                      <textarea value={tc.expectedOutput} onChange={e=>updateTC(i,'expectedOutput',e.target.value)} rows={2} placeholder="Exact expected output"
                        style={{ width:'100%',padding:'5px 8px',borderRadius:5,border:'1px solid #2a3554',background:'#1a2035',color:'#e2e8f0',fontSize:11,fontFamily:'monospace',resize:'none',outline:'none',boxSizing:'border-box' }}/>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display:'flex',gap:8,justifyContent:'flex-end',paddingTop:8,borderTop:'1px solid #2a3554' }}>
            <button type="button" onClick={()=>{setShowCreate(false);setShowEdit(null);setForm(blank);}} style={{ padding:'8px 16px',borderRadius:7,border:'1px solid #2a3554',background:'transparent',color:'#64748b',fontSize:12,fontWeight:600,cursor:'pointer' }}>Cancel</button>
            <button type="submit" disabled={saving} style={{ padding:'8px 20px',borderRadius:7,border:'none',background:'linear-gradient(135deg,#3b82f6,#2563eb)',color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer' }}>
              {saving ? '⏳ Saving…' : showEdit ? '💾 Update' : '＋ Create Assignment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return (
    <AppLayout title="Assignments" actions={
      <button className="btn btn-primary" onClick={()=>{setForm(blank);setShowCreate(true)}}>＋ New Assignment</button>
    }>
      {loading ? <div className="loading">Loading…</div> : assignments.length === 0 ? (
        <div className="empty" style={{ padding:48,textAlign:'center' }}>
          <div style={{ fontSize:48,marginBottom:12 }}>📝</div>
          <h3 style={{ color:'#e2e8f0',marginBottom:8 }}>No assignments yet</h3>
          <p style={{ color:'#64748b',marginBottom:20 }}>Create assignments with auto test cases — students submit and get instant scores</p>
          <button className="btn btn-primary" onClick={()=>setShowCreate(true)}>＋ Create First Assignment</button>
        </div>
      ) : (
        <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(340px,1fr))',gap:16 }}>
          {assignments.map(a=>(
            <div key={a._id} style={{ background:'#161b27',border:'1px solid #1e2740',borderRadius:12,padding:20,display:'flex',flexDirection:'column',gap:12 }}>
              <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start' }}>
                <div style={{ flex:1,minWidth:0 }}>
                  <h3 style={{ fontSize:14,fontWeight:700,color:'#e2e8f0',marginBottom:4,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{a.title}</h3>
                  {a.description&&<p style={{ fontSize:12,color:'#64748b',lineHeight:1.5 }}>{a.description.slice(0,80)}{a.description.length>80?'…':''}</p>}
                </div>
                <span style={{ fontSize:10,fontWeight:700,textTransform:'uppercase',background:`${LANG_COLOR[a.language]||'#3b82f6'}20`,color:LANG_COLOR[a.language]||'#3b82f6',border:`1px solid ${LANG_COLOR[a.language]||'#3b82f6'}40`,padding:'2px 7px',borderRadius:20,marginLeft:8,flexShrink:0 }}>
                  {LANG_ICON[a.language]} {a.language}
                </span>
              </div>
              <div style={{ display:'flex',gap:12,fontSize:11,color:'#64748b' }}>
                <span>🧪 {a.testCases?.length||0} tests</span>
                {a.deadline&&<span>⏰ {new Date(a.deadline).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</span>}
                <span style={{ color: a.isActive?'#22c55e':'#ef4444' }}>{a.isActive?'● Active':'○ Inactive'}</span>
              </div>
              <div style={{ display:'flex',gap:6,flexWrap:'wrap' }}>
                <button onClick={()=>viewSubmissions(a._id)} style={{ padding:'5px 12px',borderRadius:7,border:'1px solid #2a3554',background:'transparent',color:'#94a3b8',fontSize:11,fontWeight:600,cursor:'pointer' }}>📊 Submissions</button>
                <button onClick={()=>{setForm({...a,deadline:a.deadline?new Date(a.deadline).toISOString().slice(0,16):''});setShowEdit(a);}} style={{ padding:'5px 12px',borderRadius:7,border:'1px solid rgba(245,158,11,0.3)',background:'rgba(245,158,11,0.08)',color:'#f59e0b',fontSize:11,fontWeight:600,cursor:'pointer' }}>✏️ Edit</button>
                <button onClick={()=>deleteAssignment(a._id)} style={{ padding:'5px 12px',borderRadius:7,border:'1px solid rgba(239,68,68,0.3)',background:'rgba(239,68,68,0.08)',color:'#ef4444',fontSize:11,fontWeight:600,cursor:'pointer' }}>🗑️ Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && formModal('📝 New Assignment')}
      {showEdit && formModal('✏️ Edit Assignment')}

      {/* Submissions Modal */}
      {showSubs && (
        <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:2000 }} onClick={()=>setShowSubs(null)}>
          <div style={{ background:'#1a2035',borderRadius:14,padding:24,width:'min(700px,95vw)',maxHeight:'80vh',overflow:'auto',boxShadow:'0 20px 60px rgba(0,0,0,0.5)',border:'1px solid #2a3554',position:'relative' }} onClick={e=>e.stopPropagation()}>
            <button onClick={()=>setShowSubs(null)} style={{ position:'absolute',top:14,right:16,background:'none',border:'none',fontSize:20,cursor:'pointer',color:'#64748b' }}>✕</button>
            <h2 style={{ fontSize:16,fontWeight:700,color:'#e2e8f0',marginBottom:20 }}>📊 Submissions</h2>
            {submissions.length===0 ? (
              <p style={{ color:'#64748b',textAlign:'center',padding:32 }}>No submissions yet</p>
            ) : (
              <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
                {submissions.map(s=>(
                  <div key={s._id} style={{ background:'#0f1117',border:'1px solid #1e2740',borderRadius:10,padding:'12px 14px' }}>
                    <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8 }}>
                      <span style={{ fontSize:13,fontWeight:700,color:'#e2e8f0' }}>{s.studentId?.name||'Unknown'}</span>
                      <div style={{ display:'flex',gap:8,alignItems:'center' }}>
                        <span style={{ fontSize:13,fontWeight:800,color: s.score>=80?'#22c55e':s.score>=50?'#f59e0b':'#ef4444' }}>{s.score}%</span>
                        <span style={{ fontSize:11,color:'#64748b' }}>{s.passed}/{s.totalCases} passed</span>
                      </div>
                    </div>
                    <div style={{ display:'flex',gap:6,flexWrap:'wrap' }}>
                      {s.testResults?.map((t,i)=>(
                        <span key={i} title={t.label} style={{ padding:'2px 8px',borderRadius:20,fontSize:10,fontWeight:700,background:t.passed?'rgba(34,197,94,0.15)':'rgba(239,68,68,0.15)',color:t.passed?'#22c55e':'#ef4444',border:`1px solid ${t.passed?'rgba(34,197,94,0.3)':'rgba(239,68,68,0.3)'}` }}>
                          {t.passed?'✓':'✗'} {t.label}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </AppLayout>
  );
}
