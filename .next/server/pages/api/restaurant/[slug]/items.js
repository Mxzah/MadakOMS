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
exports.id = "pages/api/restaurant/[slug]/items";
exports.ids = ["pages/api/restaurant/[slug]/items"];
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

/***/ "(api)/./pages/api/restaurant/[slug]/items.js":
/*!**********************************************!*\
  !*** ./pages/api/restaurant/[slug]/items.js ***!
  \**********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => (/* binding */ handler)\n/* harmony export */ });\n/* harmony import */ var fs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! fs */ \"fs\");\n/* harmony import */ var fs__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(fs__WEBPACK_IMPORTED_MODULE_0__);\n/* harmony import */ var path__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! path */ \"path\");\n/* harmony import */ var path__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(path__WEBPACK_IMPORTED_MODULE_1__);\n\n\nasync function handler(req, res) {\n    const { slug } = req.query;\n    try {\n        // Mappez les slugs vers des fichiers JSON. Ici, exemple pour sante-taouk.\n        const map = {\n            \"sante-taouk\": path__WEBPACK_IMPORTED_MODULE_1___default().join(process.cwd(), \"data\", \"items-sante-taouk.json\")\n        };\n        const filePath = map[slug];\n        if (!filePath) {\n            return res.status(404).json({\n                error: \"Restaurant introuvable\"\n            });\n        }\n        const file = await fs__WEBPACK_IMPORTED_MODULE_0__.promises.readFile(filePath, \"utf8\");\n        const data = JSON.parse(file);\n        return res.status(200).json({\n            items: data\n        });\n    } catch (err) {\n        console.error(\"API items error:\", err);\n        return res.status(500).json({\n            error: \"Impossible de charger les items\"\n        });\n    }\n}\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKGFwaSkvLi9wYWdlcy9hcGkvcmVzdGF1cmFudC9bc2x1Z10vaXRlbXMuanMiLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7QUFBbUM7QUFDWjtBQUVSLGVBQWVHLFFBQVFDLEdBQUcsRUFBRUMsR0FBRztJQUM1QyxNQUFNLEVBQUVDLElBQUksRUFBRSxHQUFHRixJQUFJRyxLQUFLO0lBRTFCLElBQUk7UUFDRiwwRUFBMEU7UUFDMUUsTUFBTUMsTUFBTTtZQUNWLGVBQWVOLGdEQUFTLENBQUNRLFFBQVFDLEdBQUcsSUFBSSxRQUFRO1FBQ2xEO1FBQ0EsTUFBTUMsV0FBV0osR0FBRyxDQUFDRixLQUFLO1FBQzFCLElBQUksQ0FBQ00sVUFBVTtZQUNiLE9BQU9QLElBQUlRLE1BQU0sQ0FBQyxLQUFLQyxJQUFJLENBQUM7Z0JBQUVDLE9BQU87WUFBeUI7UUFDaEU7UUFFQSxNQUFNQyxPQUFPLE1BQU1mLHdDQUFFQSxDQUFDZ0IsUUFBUSxDQUFDTCxVQUFVO1FBQ3pDLE1BQU1NLE9BQU9DLEtBQUtDLEtBQUssQ0FBQ0o7UUFDeEIsT0FBT1gsSUFBSVEsTUFBTSxDQUFDLEtBQUtDLElBQUksQ0FBQztZQUFFTyxPQUFPSDtRQUFLO0lBQzVDLEVBQUUsT0FBT0ksS0FBSztRQUNaQyxRQUFRUixLQUFLLENBQUMsb0JBQW9CTztRQUNsQyxPQUFPakIsSUFBSVEsTUFBTSxDQUFDLEtBQUtDLElBQUksQ0FBQztZQUFFQyxPQUFPO1FBQWtDO0lBQ3pFO0FBQ0YiLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly9tYWRhay1vbXMtZnJvbnRlbmQvLi9wYWdlcy9hcGkvcmVzdGF1cmFudC9bc2x1Z10vaXRlbXMuanM/MDBjYyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBwcm9taXNlcyBhcyBmcyB9IGZyb20gJ2ZzJ1xyXG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJ1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgYXN5bmMgZnVuY3Rpb24gaGFuZGxlcihyZXEsIHJlcykge1xyXG4gIGNvbnN0IHsgc2x1ZyB9ID0gcmVxLnF1ZXJ5XHJcblxyXG4gIHRyeSB7XHJcbiAgICAvLyBNYXBwZXogbGVzIHNsdWdzIHZlcnMgZGVzIGZpY2hpZXJzIEpTT04uIEljaSwgZXhlbXBsZSBwb3VyIHNhbnRlLXRhb3VrLlxyXG4gICAgY29uc3QgbWFwID0ge1xyXG4gICAgICAnc2FudGUtdGFvdWsnOiBwYXRoLmpvaW4ocHJvY2Vzcy5jd2QoKSwgJ2RhdGEnLCAnaXRlbXMtc2FudGUtdGFvdWsuanNvbicpLFxyXG4gICAgfVxyXG4gICAgY29uc3QgZmlsZVBhdGggPSBtYXBbc2x1Z11cclxuICAgIGlmICghZmlsZVBhdGgpIHtcclxuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNDA0KS5qc29uKHsgZXJyb3I6ICdSZXN0YXVyYW50IGludHJvdXZhYmxlJyB9KVxyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGZpbGUgPSBhd2FpdCBmcy5yZWFkRmlsZShmaWxlUGF0aCwgJ3V0ZjgnKVxyXG4gICAgY29uc3QgZGF0YSA9IEpTT04ucGFyc2UoZmlsZSlcclxuICAgIHJldHVybiByZXMuc3RhdHVzKDIwMCkuanNvbih7IGl0ZW1zOiBkYXRhIH0pXHJcbiAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICBjb25zb2xlLmVycm9yKCdBUEkgaXRlbXMgZXJyb3I6JywgZXJyKVxyXG4gICAgcmV0dXJuIHJlcy5zdGF0dXMoNTAwKS5qc29uKHsgZXJyb3I6ICdJbXBvc3NpYmxlIGRlIGNoYXJnZXIgbGVzIGl0ZW1zJyB9KVxyXG4gIH1cclxufVxyXG4iXSwibmFtZXMiOlsicHJvbWlzZXMiLCJmcyIsInBhdGgiLCJoYW5kbGVyIiwicmVxIiwicmVzIiwic2x1ZyIsInF1ZXJ5IiwibWFwIiwiam9pbiIsInByb2Nlc3MiLCJjd2QiLCJmaWxlUGF0aCIsInN0YXR1cyIsImpzb24iLCJlcnJvciIsImZpbGUiLCJyZWFkRmlsZSIsImRhdGEiLCJKU09OIiwicGFyc2UiLCJpdGVtcyIsImVyciIsImNvbnNvbGUiXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(api)/./pages/api/restaurant/[slug]/items.js\n");

/***/ })

};
;

// load runtime
var __webpack_require__ = require("../../../../webpack-api-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = (__webpack_exec__("(api)/./pages/api/restaurant/[slug]/items.js"));
module.exports = __webpack_exports__;

})();