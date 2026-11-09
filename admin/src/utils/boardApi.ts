import axios from 'axios';

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

/** 게시판 API (보호 세션 연장 인터셉터 대상 — main.ts에서 등록) */
export const boardHttp = axios.create({
  baseURL: `${BASE_URL}/api/board`,
  withCredentials: true // 쿠키 전송용
});

const api = boardHttp;

api.interceptors.request.use(config => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const boardApi = {
  // 목록 조회
  getPosts: (params: { category?: string; page?: number; search?: string; limit?: number }, signal?: AbortSignal) =>
    api.get('/', { params, signal }),

  // 상세 조회
  getPost: (id: string) => api.get(`/${id}`),
  
  // 게시글 작성 (FormData 사용)
  createPost: (formData: FormData, token: string) => 
    api.post('/', formData, {
      headers: { 
        Authorization: `Bearer ${token}`,
        'Content-Type': 'multipart/form-data'
      }
    }
  ),
  
  // 게시글 수정 (PATCH)
  updatePost: (id: string, formData: FormData, token: string) => 
    api.patch(`/${id}`, formData, {
      headers: { 
        Authorization: `Bearer ${token}`,
        'Content-Type': 'multipart/form-data'
      }
    }
  ),
  
  // 게시글 삭제
  deletePost: (id: string, token: string) => 
    api.delete(`/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    }
  )
};
