# **Key Management System - API Documentation for Frontend Developers**

This document provides detailed instructions for frontend developers to integrate with the **Key Management System API**. The API is deployed on Vercel, and the base URL is:

```
https://locker-silk.vercel.app
```

---

## **Table of Contents**
1. [Base URL](#base-url)
2. [API Endpoints](#api-endpoints)
   - [Register a Student](#1-register-a-student)
   - [Request a Key](#2-request-a-key)
   - [Add a Key](#3-add-a-key)
   - [Get Student Information](#4-get-student-information)
   - [Return a Key](#5-return-a-key)
   - [Get All Students](#6-get-all-students)
3. [Request and Response Examples](#request-and-response-examples)
4. [Error Handling](#error-handling)
5. [Testing the API](#testing-the-api)
6. [CORS Configuration](#cors-configuration)
7. [Contact Information](#contact-information)

---

## **Base URL**
All API requests should be made to the following base URL:
```
https://locker-silk.vercel.app
```

---

## **API Endpoints**

### **1. Register a Student**
- **Endpoint**: `POST /api/student/register`
- **Description**: Register a new student with RFID, student ID, and name.
- **Request Body**:
  ```json
  {
    "rfId": "123456789",
    "studentId": "221-35-951",
    "studentName": "John Doe"
  }
  ```
- **Response**:
  ```json
  {
    "message": "Student registered successfully"
  }
  ```

---

### **2. Request a Key**
- **Endpoint**: `POST /api/key/request`
- **Description**: Assign a key to a student using their RFID.
- **Request Body**:
  ```json
  {
    "rfid": "123456789"
  }
  ```
- **Response**:
  ```json
  {
    "message": "Key assigned successfully",
    "keyId": "1"
  }
  ```

---

### **3. Add a Key**
- **Endpoint**: `POST /api/key/add`
- **Description**: Add a new key to the system.
- **Request Body**:
  ```json
  {
    "keyId": "1"
  }
  ```
- **Response**:
  ```json
  {
    "message": "Key added successfully"
  }
  ```

---

### **4. Get Student Information**
- **Endpoint**: `GET /api/student/info/:studentId`
- **Description**: Retrieve student information by student ID.
- **Response**:
  ```json
  {
    "_id": "65e8f1b2e4b0f1a2b3c4d5e6",
    "studentId": "221-35-951",
    "studentName": "John Doe",
    "rfId": "123456789",
    "keyStatus": "Available",
    "registerDate": "2024-03-07T10:40:24.250Z",
    "takenKeyNumber": null
  }
  ```

---

### **5. Return a Key**
- **Endpoint**: `POST /api/key/return`
- **Description**: Return a key using RFID or key number.
- **Request Body**:
  ```json
  {
    "rfid": "123456789",
    "keyNumber": "1"
  }
  ```
- **Response**:
  ```json
  {
    "message": "Key returned successfully"
  }
  ```

---

### **6. Get All Students**
- **Endpoint**: `GET /api/student/stack`
- **Description**: Retrieve a list of all registered students.
- **Response**:
  ```json
  [
    {
      "_id": "65e8f1b2e4b0f1a2b3c4d5e6",
      "studentId": "221-35-951",
      "studentName": "John Doe",
      "rfId": "123456789",
      "keyStatus": "Available",
      "registerDate": "2024-03-07T10:40:24.250Z",
      "takenKeyNumber": null
    }
  ]
  ```

---

## **Request and Response Examples**

### **Example: Register a Student**
- **Request**:
  ```bash
  curl -X POST https://locker-silk.vercel.app/api/student/register \
  -H "Content-Type: application/json" \
  -d '{
    "rfId": "123456789",
    "studentId": "221-35-951",
    "studentName": "John Doe"
  }'
  ```
- **Response**:
  ```json
  {
    "message": "Student registered successfully"
  }
  ```

### **Example: Request a Key**
- **Request**:
  ```bash
  curl -X POST https://locker-silk.vercel.app/api/key/request \
  -H "Content-Type: application/json" \
  -d '{
    "rfid": "123456789"
  }'
  ```
- **Response**:
  ```json
  {
    "message": "Key assigned successfully",
    "keyId": "1"
  }
  ```

---

## **Error Handling**
The API returns the following HTTP status codes:
- **200**: Success
- **400**: Bad Request (invalid input)
- **404**: Not Found (resource not found)
- **500**: Internal Server Error (server-side issue)

Error responses include a `message` field with details:
```json
{
  "message": "Student not found"
}
```

---

## **Testing the API**
You can test the API using tools like [Postman](https://www.postman.com/) or directly in your browser console.

### **Example: Fetch All Students**
```javascript
fetch('https://locker-silk.vercel.app/api/student/stack')
  .then(response => response.json())
  .then(data => console.log(data))
  .catch(error => console.error('Error:', error));
```

---

## **CORS Configuration**
The API is configured to allow requests from all origins (`*`). You can make requests from any frontend application without CORS issues.

---

## **Contact Information**
For any questions or issues, please contact:
- **Name**: Md Arif Ahammed Reza
- **Email**: mdarifahammedreza@gmail.com
- **GitHub**: [REZA](https://github.com/mdarifahammedreza)

---

This document provides all the necessary information for frontend developers to integrate with the Key Management System API.