import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import {
  getStudents,
  addStudent,
  updateStudent,
  deleteStudent,
} from "../services/studentService";

// Thunks wrap the existing service functions — no HTTP logic lives here,
// only orchestration (services/ stays the only place that calls axios).
export const fetchStudents = createAsyncThunk(
  "students/fetchStudents",
  async ({ search = "", page = 1, limit = 6, minCgpa = "", maxCgpa = "" } = {}) => {
    const response = await getStudents(search, page, limit, minCgpa, maxCgpa);

    return response.data;
  },
);

export const addStudentThunk = createAsyncThunk(
  "students/addStudent",
  async (student) => {
    const response = await addStudent(student);

    return response.data;
  },
);

export const updateStudentThunk = createAsyncThunk(
  "students/updateStudent",
  async ({ id, student }) => {
    const response = await updateStudent(id, student);

    return response.data;
  },
);

export const deleteStudentThunk = createAsyncThunk(
  "students/deleteStudent",
  async (id) => {
    const response = await deleteStudent(id);

    return response.data;
  },
);

const initialState = {
  list: [],
  totalPages: 1,
  currentPage: 1,
  loading: false,
  error: null,
};

const studentSlice = createSlice({
  name: "students",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchStudents.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchStudents.fulfilled, (state, action) => {
        state.loading = false;
        state.list = action.payload.data || [];
        state.totalPages = action.payload.totalPages || 1;
        state.currentPage = action.payload.currentPage || 1;
      })
      .addCase(fetchStudents.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
        state.list = [];
      })

      // add/update/delete splice the list directly rather than re-dispatching
      // fetchStudents from here — a reducer can't dispatch another thunk, so
      // this is the only option available inside extraReducers. The
      // components that call these thunks (AddStudent/EditStudent/
      // StudentCard) additionally dispatch fetchStudents() with default
      // params afterward for an authoritative, pagination-correct refresh —
      // the same two-step shape those pages already used before Redux.
      .addCase(addStudentThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(addStudentThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.list.push(action.payload.student);
      })
      .addCase(addStudentThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })

      .addCase(updateStudentThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateStudentThunk.fulfilled, (state, action) => {
        state.loading = false;

        const index = state.list.findIndex(
          (s) => s.id === action.payload.student.id,
        );

        if (index !== -1) {
          state.list[index] = action.payload.student;
        }
      })
      .addCase(updateStudentThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })

      .addCase(deleteStudentThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteStudentThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.list = state.list.filter(
          (s) => s.id !== action.payload.student.id,
        );
      })
      .addCase(deleteStudentThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      });
  },
});

export default studentSlice.reducer;
