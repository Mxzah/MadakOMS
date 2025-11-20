"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
(() => {
var exports = {};
exports.id = "pages/api/restaurant/[slug]/menu-categories";
exports.ids = ["pages/api/restaurant/[slug]/menu-categories"];
exports.modules = {

/***/ "fs":
/*!*********************!*\
  !*** external "fs" ***!
  \*********************/
/***/ ((module) => {

module.exports = require("fs");

/***/ }),

/***/ "path":
/*!***********************!*\
  !*** external "path" ***!
  \***********************/
/***/ ((module) => {

module.exports = require("path");

/***/ }),

/***/ "(api)/./pages/api/restaurant/[slug]/menu-categories.js":
/*!********************************************************!*\
  !*** ./pages/api/restaurant/[slug]/menu-categories.js ***!
  \********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => (/* binding */ handler)\n/* harmony export */ });\n/* harmony import */ var fs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! fs */ \"fs\");\n/* harmony import */ var fs__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(fs__WEBPACK_IMPORTED_MODULE_0__);\n/* harmony import */ var path__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! path */ \"path\");\n/* harmony import */ var path__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(path__WEBPACK_IMPORTED_MODULE_1__);\n\n\nasync function handler(req, res) {\n    const { slug } = req.query;\n    try {\n        const map = {\n            \"sante-taouk\": path__WEBPACK_IMPORTED_MODULE_1___default().join(process.cwd(), \"data\", \"menu_categories.json\")\n        };\n        const filePath = map[slug];\n        if (!filePath) {\n            return res.status(404).json({\n                error: \"Restaurant introuvable\"\n            });\n        }\n        const file = await fs__WEBPACK_IMPORTED_MODULE_0__.promises.readFile(filePath, \"utf8\");\n        const data = JSON.parse(file);\n        return res.status(200).json({\n            categories: data\n        });\n    } catch (err) {\n        console.error(\"API menu-categories error:\", err);\n        return res.status(500).json({\n            error: \"Impossible de charger les cat\\xe9gories\"\n        });\n    }\n}\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKGFwaSkvLi9wYWdlcy9hcGkvcmVzdGF1cmFudC9bc2x1Z10vbWVudS1jYXRlZ29yaWVzLmpzIiwibWFwcGluZ3MiOiI7Ozs7Ozs7O0FBQW1DO0FBQ1o7QUFFUixlQUFlRyxRQUFRQyxHQUFHLEVBQUVDLEdBQUc7SUFDNUMsTUFBTSxFQUFFQyxJQUFJLEVBQUUsR0FBR0YsSUFBSUcsS0FBSztJQUUxQixJQUFJO1FBQ0YsTUFBTUMsTUFBTTtZQUNWLGVBQWVOLGdEQUFTLENBQUNRLFFBQVFDLEdBQUcsSUFBSSxRQUFRO1FBQ2xEO1FBQ0EsTUFBTUMsV0FBV0osR0FBRyxDQUFDRixLQUFLO1FBQzFCLElBQUksQ0FBQ00sVUFBVTtZQUNiLE9BQU9QLElBQUlRLE1BQU0sQ0FBQyxLQUFLQyxJQUFJLENBQUM7Z0JBQUVDLE9BQU87WUFBeUI7UUFDaEU7UUFFQSxNQUFNQyxPQUFPLE1BQU1mLHdDQUFFQSxDQUFDZ0IsUUFBUSxDQUFDTCxVQUFVO1FBQ3pDLE1BQU1NLE9BQU9DLEtBQUtDLEtBQUssQ0FBQ0o7UUFDeEIsT0FBT1gsSUFBSVEsTUFBTSxDQUFDLEtBQUtDLElBQUksQ0FBQztZQUFFTyxZQUFZSDtRQUFLO0lBQ2pELEVBQUUsT0FBT0ksS0FBSztRQUNaQyxRQUFRUixLQUFLLENBQUMsOEJBQThCTztRQUM1QyxPQUFPakIsSUFBSVEsTUFBTSxDQUFDLEtBQUtDLElBQUksQ0FBQztZQUFFQyxPQUFPO1FBQXVDO0lBQzlFO0FBQ0YiLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly9tYWRhay1vbXMtZnJvbnRlbmQvLi9wYWdlcy9hcGkvcmVzdGF1cmFudC9bc2x1Z10vbWVudS1jYXRlZ29yaWVzLmpzPzM0NTMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgcHJvbWlzZXMgYXMgZnMgfSBmcm9tICdmcydcclxuaW1wb3J0IHBhdGggZnJvbSAncGF0aCdcclxuXHJcbmV4cG9ydCBkZWZhdWx0IGFzeW5jIGZ1bmN0aW9uIGhhbmRsZXIocmVxLCByZXMpIHtcclxuICBjb25zdCB7IHNsdWcgfSA9IHJlcS5xdWVyeVxyXG5cclxuICB0cnkge1xyXG4gICAgY29uc3QgbWFwID0ge1xyXG4gICAgICAnc2FudGUtdGFvdWsnOiBwYXRoLmpvaW4ocHJvY2Vzcy5jd2QoKSwgJ2RhdGEnLCAnbWVudV9jYXRlZ29yaWVzLmpzb24nKSxcclxuICAgIH1cclxuICAgIGNvbnN0IGZpbGVQYXRoID0gbWFwW3NsdWddXHJcbiAgICBpZiAoIWZpbGVQYXRoKSB7XHJcbiAgICAgIHJldHVybiByZXMuc3RhdHVzKDQwNCkuanNvbih7IGVycm9yOiAnUmVzdGF1cmFudCBpbnRyb3V2YWJsZScgfSlcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBmaWxlID0gYXdhaXQgZnMucmVhZEZpbGUoZmlsZVBhdGgsICd1dGY4JylcclxuICAgIGNvbnN0IGRhdGEgPSBKU09OLnBhcnNlKGZpbGUpXHJcbiAgICByZXR1cm4gcmVzLnN0YXR1cygyMDApLmpzb24oeyBjYXRlZ29yaWVzOiBkYXRhIH0pXHJcbiAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICBjb25zb2xlLmVycm9yKCdBUEkgbWVudS1jYXRlZ29yaWVzIGVycm9yOicsIGVycilcclxuICAgIHJldHVybiByZXMuc3RhdHVzKDUwMCkuanNvbih7IGVycm9yOiAnSW1wb3NzaWJsZSBkZSBjaGFyZ2VyIGxlcyBjYXTDqWdvcmllcycgfSlcclxuICB9XHJcbn1cclxuIl0sIm5hbWVzIjpbInByb21pc2VzIiwiZnMiLCJwYXRoIiwiaGFuZGxlciIsInJlcSIsInJlcyIsInNsdWciLCJxdWVyeSIsIm1hcCIsImpvaW4iLCJwcm9jZXNzIiwiY3dkIiwiZmlsZVBhdGgiLCJzdGF0dXMiLCJqc29uIiwiZXJyb3IiLCJmaWxlIiwicmVhZEZpbGUiLCJkYXRhIiwiSlNPTiIsInBhcnNlIiwiY2F0ZWdvcmllcyIsImVyciIsImNvbnNvbGUiXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(api)/./pages/api/restaurant/[slug]/menu-categories.js\n");

/***/ })

};
;

// load runtime
var __webpack_require__ = require("../../../../webpack-api-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = (__webpack_exec__("(api)/./pages/api/restaurant/[slug]/menu-categories.js"));
module.exports = __webpack_exports__;

})();