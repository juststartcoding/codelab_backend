const express = require("express");
const db = require("../db");
const { getDefaultContent } = require("../helpers");
const { auth, requireRole } = require("../middleware/auth");

const router = express.Router();

// Make a simple file id
const makeId = () =>
  Math.random().toString(36).substr(2, 9) + Date.now().toString(36);

// Populate studentId field manually (NeDB has no populate)
async function populateStudent(project) {
  if (!project) return null;
  const student = project.studentId
    ? await db.users.findOne({ _id: project.studentId })
    : null;
  return {
    ...project,
    studentId: student
      ? { _id: student._id, name: student.name, email: student.email }
      : null,
  };
}

// Student: get own projects
router.get("/my", auth, requireRole("student"), async (req, res) => {
  try {
    const projects = await db.projects.find({ studentId: req.user._id }).lean();
    projects.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    res.json(projects);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Tutor/Admin: get ALL projects
router.get("/", auth, requireRole("tutor", "admin"), async (req, res) => {
  try {
    const projects = await db.projects.find({}).lean();
    const populated = await Promise.all(projects.map(populateStudent));
    populated.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get single project
router.get("/:id", auth, async (req, res) => {
  try {
    const project = await db.projects.findOne({ _id: req.params.id });
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (
      req.user.role === "student" &&
      project.studentId?.toString() !== req.user._id?.toString()
    )
      return res.status(403).json({ message: "Access denied" });
    res.json(await populateStudent(project));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create project
router.post("/", auth, requireRole("student"), async (req, res) => {
  try {
    const { name, description, language } = req.body;
    if (!name)
      return res.status(400).json({ message: "Project name required" });
    const lang = language || "c";
    const ext =
      lang === "cpp"
        ? "cpp"
        : lang === "python"
          ? "py"
          : lang === "java"
            ? "java"
            : lang === "javascript"
              ? "js"
              : "c";
    const project = await db.projects.insert({
      name,
      description: description || "",
      studentId: req.user._id,
      language: lang,
      files: [
        {
          _id: makeId(),
          name: `main.${ext}`,
          language: lang,
          content: getDefaultContent(lang),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      comments: [],
      isSubmitted: false,
      grade: "",
      tutorFeedback: "",
      lastEditedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    res.status(201).json(project);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Add file to project
router.post("/:id/files", auth, async (req, res) => {
  try {
    const project = await db.projects.findOne({ _id: req.params.id });
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (
      req.user.role === "student" &&
      project.studentId?.toString() !== req.user._id?.toString()
    )
      return res.status(403).json({ message: "Access denied" });
    const { name, language } = req.body;
    const newFile = {
      _id: makeId(),
      name,
      language: language || "c",
      content: getDefaultContent(language || "c"),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const files = [...project.files, newFile];
    await db.projects.update(
      { _id: req.params.id },
      { $set: { files, updatedAt: new Date() } },
    );
    const updated = await db.projects.findOne({ _id: req.params.id });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update file content
router.patch("/:id/files/:fileId", auth, async (req, res) => {
  try {
    const project = await db.projects.findOne({ _id: req.params.id });
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (
      req.user.role === "student" &&
      project.studentId?.toString() !== req.user._id?.toString()
    )
      return res.status(403).json({ message: "Access denied" });
    const files = project.files.map((f) =>
      f._id?.toString() === req.params.fileId
        ? {
            ...f,
            ...(req.body.content !== undefined && {
              content: req.body.content,
            }),
            ...(req.body.name && { name: req.body.name }),
            updatedAt: new Date(),
          }
        : f,
    );
    await db.projects.update(
      { _id: req.params.id },
      { $set: { files, lastEditedBy: req.user._id, updatedAt: new Date() } },
    );
    const updated = await db.projects.findOne({ _id: req.params.id });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Delete file
router.delete(
  "/:id/files/:fileId",
  auth,
  requireRole("student"),
  async (req, res) => {
    try {
      const project = await db.projects.findOne({ _id: req.params.id });
      if (!project)
        return res.status(404).json({ message: "Project not found" });
      if (project.studentId?.toString() !== req.user._id?.toString())
        return res.status(403).json({ message: "Access denied" });
      const files = project.files.filter((f) => f._id !== req.params.fileId);
      await db.projects.update(
        { _id: req.params.id },
        { $set: { files, updatedAt: new Date() } },
      );
      const updated = await db.projects.findOne({ _id: req.params.id });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },
);

// Tutor: add comment
router.post(
  "/:id/comments",
  auth,
  requireRole("tutor", "admin"),
  async (req, res) => {
    try {
      const project = await db.projects.findOne({ _id: req.params.id });
      if (!project)
        return res.status(404).json({ message: "Project not found" });
      const comment = {
        _id: makeId(),
        tutorId: req.user._id,
        tutorName: req.user.name,
        ...req.body,
        createdAt: new Date(),
      };
      const comments = [...project.comments, comment];
      await db.projects.update(
        { _id: req.params.id },
        { $set: { comments, updatedAt: new Date() } },
      );
      const updated = await db.projects.findOne({ _id: req.params.id });
      res.json(await populateStudent(updated));
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },
);

// Tutor: grade/feedback
router.patch(
  "/:id/feedback",
  auth,
  requireRole("tutor", "admin"),
  async (req, res) => {
    try {
      await db.projects.update(
        { _id: req.params.id },
        {
          $set: {
            grade: req.body.grade || "",
            tutorFeedback: req.body.feedback || "",
            updatedAt: new Date(),
          },
        },
      );
      const updated = await db.projects.findOne({ _id: req.params.id });
      res.json(await populateStudent(updated));
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },
);

// Student: delete project
router.delete("/:id", auth, requireRole("student"), async (req, res) => {
  try {
    const project = await db.projects.findOne({ _id: req.params.id });
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (project.studentId?.toString() !== req.user._id?.toString())
      return res.status(403).json({ message: "Access denied" });
    await db.projects.remove({ _id: req.params.id }, {});
    res.json({ message: "Project deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

// ── /run — Execute code (server-side fallback) ──────────────────────────────
const { execSync } = require("child_process");
const fs_run = require("fs");
const os_run = require("os");
const path_run = require("path");

router.post("/run", auth, async (req, res) => {
  const { code, language } = req.body;
  if (!code)
    return res.status(400).json({ output: "No code provided", error: true });

  const tmpDir = fs_run.mkdtempSync(path_run.join(os_run.tmpdir(), "codelab-"));
  const timeout = 8000; // 8 second timeout

  try {
    let filename, compileCmd, runCmd;

    switch (language) {
      case "c":
        filename = path_run.join(tmpDir, "main.c");
        fs_run.writeFileSync(filename, code);
        compileCmd = `gcc "${filename}" -o "${path_run.join(tmpDir, "main")}" -lm 2>&1`;
        runCmd = `"${path_run.join(tmpDir, "main")}"`;
        break;
      case "cpp":
        filename = path_run.join(tmpDir, "main.cpp");
        fs_run.writeFileSync(filename, code);
        compileCmd = `g++ "${filename}" -o "${path_run.join(tmpDir, "main")}" -std=c++17 2>&1`;
        runCmd = `"${path_run.join(tmpDir, "main")}"`;
        break;
      case "python":
        filename = path_run.join(tmpDir, "main.py");
        fs_run.writeFileSync(filename, code);
        compileCmd = null;
        runCmd = `python3 "${filename}"`;
        break;
      case "java":
        filename = path_run.join(tmpDir, "Main.java");
        fs_run.writeFileSync(filename, code);
        compileCmd = `javac "${filename}" -d "${tmpDir}" 2>&1`;
        runCmd = `java -cp "${tmpDir}" Main`;
        break;
      case "javascript":
        filename = path_run.join(tmpDir, "main.js");
        fs_run.writeFileSync(filename, code);
        compileCmd = null;
        runCmd = `node "${filename}"`;
        break;
      default:
        return res.json({
          output: `Language "${language}" is not supported for server-side execution.`,
          error: false,
        });
    }

    // Compile if needed
    if (compileCmd) {
      try {
        execSync(compileCmd, { timeout, stdio: "pipe" });
      } catch (compileErr) {
        fs_run.rmSync(tmpDir, { recursive: true, force: true });
        return res.json({
          output: compileErr.stdout?.toString() || compileErr.message,
          error: true,
          status: "Compilation Error",
        });
      }
    }

    // Run
    try {
      const stdout = execSync(runCmd, {
        timeout,
        stdio: "pipe",
        maxBuffer: 1024 * 1024,
      }).toString();
      res.json({
        output: stdout || "(no output)",
        error: false,
        status: "Accepted",
      });
    } catch (runErr) {
      const msg =
        runErr.stdout?.toString() ||
        runErr.stderr?.toString() ||
        runErr.message;
      res.json({ output: msg, error: true, status: "Runtime Error" });
    }
  } catch (err) {
    res.json({ output: err.message, error: true, status: "Error" });
  } finally {
    try {
      fs_run.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  }
});
