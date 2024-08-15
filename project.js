// This function takes the translation and two rotation angles (in radians) as input arguments.
// The two rotations are applied around x and y axes.
// It returns the combined 4x4 transformation matrix as an array in column-major order.
// You can use the MatrixMult function defined in project5.html to multiply two 4x4 matrices in the same format.
function GetModelViewMatrix( translationX, translationY, translationZ, rotationX, rotationY )
{
	// [TO-DO] Modify the code below to form the transformation matrix.
	let trans = translationMatrix(translationX, translationY, translationZ);
	let rotX = XRotationMatrix(rotationX);
	let rotY = YRotationMatrix(rotationY);
	return MatrixMult(MatrixMult(trans, rotY), rotX);
}

function createShader(vertexShaderSource, fragmentShaderSource) {
	// Create vertex shader
	const vertexShader = gl.createShader(gl.VERTEX_SHADER);
	gl.shaderSource(vertexShader, vertexShaderSource);
	gl.compileShader(vertexShader);

	// Create fragment shader
	const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
	gl.shaderSource(fragmentShader, fragmentShaderSource);
	gl.compileShader(fragmentShader);

	// Create shader program
	shaderProgram = gl.createProgram();

	// Attach shaders to the program
	gl.attachShader(shaderProgram, vertexShader);
	gl.attachShader(shaderProgram, fragmentShader);

	// Link the program
	gl.linkProgram(shaderProgram);
	if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
		console.error('ERROR linking program!', gl.getProgramInfoLog(shaderProgram));
		return;
	}

	return shaderProgram;
}


// [TO-DO] Complete the implementation of the following class.

class MeshDrawer
{
	// The constructor is a good place for taking care of the necessary initializations.
	constructor()
	{
		// [TO-DO] initializations
		this.vertexBuffer = gl.createBuffer();
		this.texCoordBuffer = gl.createBuffer();
		this.texture = gl.createTexture();
		this.normals = gl.createBuffer();

		this.lightDirection = [0.0, 0.0, 0.0];

		this.numTriangles = 0;
		this.swapyz = false;
		this.showTex = true;
		this.loadedTexture = false;
		this.shininess = 100;

		this.updateProgram();
	}

	getShader(){
		var attributes = `
			attribute vec3 a_position;
			uniform vec3 u_traslation;

			uniform mat4 u_transform;

			attribute vec3 a_normal;
			varying vec3 v_normal;
			attribute vec3 a_lightSource;
			varying vec3 v_position;
		`;
		if (this.showTex && this.loadedTexture){
			attributes += `
				attribute vec2 a_texCoord; // New attribute for texture coordinates
				varying vec2 v_texCoord; // New varying variable to pass texture coordinates to the fragment shader
			`;
		}
		var gl_position = `gl_Position = u_transform * vec4(a_position, 1);`
		if (this.swapyz)
			gl_position = `gl_Position = u_transform * vec4(a_position.x, a_position.z, a_position.y, 1);`
		var v_texCoord = ``
		if (this.showTex && this.loadedTexture){
			v_texCoord = `v_texCoord = a_texCoord;`
		}

		var vertexShaderSource = `
			${attributes} 
			
			void main() {
				vec3 a_position = a_position + u_traslation;
				v_normal = a_normal;
				v_position = a_position;
				${gl_position}
				${v_texCoord}
			}
		`
		var attributes = `precision mediump float;
		
		varying vec3 v_position;
		varying vec3 v_normal;
		uniform vec3 u_lightSource;
		uniform mat3 u_matrixNormal;
		uniform mat4 u_matrixMV;
		uniform float u_shininess;`
		if (this.showTex && this.loadedTexture){
			attributes += `
				precision mediump float;
				varying vec2 v_texCoord; // Receive texture coordinates from the vertex shader
				uniform sampler2D u_texture; // New uniform for the texture
			`;
		}
		var modelColor = `vec4 modelColor = vec4(1,gl_FragCoord.z*gl_FragCoord.z,0,1);`
		if (this.showTex && this.loadedTexture){
			modelColor = `vec4 modelColor = texture2D(u_texture, v_texCoord);`
		}
		var fragmentShaderSource = `
			${attributes}

			vec3 normalizeHomogeneous(vec4 vec) {
				return normalize(vec.xyz / vec.w);
			}

			void main() {
				vec3 viewDirection = normalizeHomogeneous(u_matrixMV*vec4(v_position, 1));

				vec3 ambientLight = vec3(1.0, 1.0, 1.0)*0.1;

				${this.swapyz ? `vec3 v_mnormal = vec3(v_normal.x, v_normal.z, v_normal.y);` : `vec3 v_mnormal = v_normal;`}
				vec3 normal = u_matrixNormal * v_mnormal;
				vec3 lightColor = vec3(1.0, 1.0, 1.0);
				float d = dot(u_lightSource, normal);
				float diffuseRatio = max(0.0, d);
				vec3 diffuseLight = diffuseRatio * lightColor;

				vec3 halfDir = normalize(u_lightSource - viewDirection);
				float specAngle = max(dot(halfDir, normal), 0.0);
				vec3 specularLight = pow(specAngle, u_shininess / 4.0) * lightColor;
				
				float distance = length(u_lightSource);
				distance = distance * distance;

				vec3 lighting = ambientLight + diffuseLight + specularLight;
				${modelColor}
				vec4 color = modelColor * vec4(lighting, 1.0);
				gl_FragColor = vec4(color);
			}
		`;

		return createShader(vertexShaderSource, fragmentShaderSource);
	}

	updateProgram(){
		this.program = this.getShader();
	}
	
	// This method is called every time the user opens an OBJ file.
	// The arguments of this function is an array of 3D vertex positions,
	// an array of 2D texture coordinates, and an array of vertex normals.
	// Every item in these arrays is a floating point value, representing one
	// coordinate of the vertex position or texture coordinate.
	// Every three consecutive elements in the vertPos array forms one vertex
	// position and every three consecutive vertex positions form a triangle.
	// Similarly, every two consecutive elements in the texCoords array
	// form the texture coordinate of a vertex and every three consecutive 
	// elements in the normals array form a vertex normal.
	// Note that this method can be called multiple times.
	setMesh( vertPos, texCoords, normals )
	{
		// [TO-DO] Update the contents of the vertex buffer objects.
		this.numTriangles = vertPos.length / 3;
		gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertPos), gl.STATIC_DRAW);

		gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoords), gl.STATIC_DRAW);

		gl.bindBuffer(gl.ARRAY_BUFFER, this.normals);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);

	}
	
	// This method is called when the user changes the state of the
	// "Swap Y-Z Axes" checkbox. 
	// The argument is a boolean that indicates if the checkbox is checked.
	swapYZ( swap )
	{
		// [TO-DO] Set the uniform parameter(s) of the vertex shader
		this.swapyz = swap;

		this.updateProgram();
	}
	
	// This method is called to draw the triangular mesh.
	// The arguments are the model-view-projection transformation matrixMVP,
	// the model-view transformation matrixMV, the same matrix returned
	// by the GetModelViewProjection function above, and the normal
	// transformation matrix, which is the inverse-transpose of matrixMV.
	draw( matrixMVP, matrixMV, matrixNormal, shift=[0, 0, 0], angle=0 )
	{
		// [TO-DO] Complete the WebGL initializations before drawing
		gl.useProgram(this.program);

		// Set up the traslation vector
		var traslation = gl.getUniformLocation(this.program, "u_traslation");
		gl.uniform3f(traslation, shift[0], shift[1], shift[2]);

		// Set up the matrixMVP
		matrixMVP = createTransformationMatrix(matrixMVP, shift, angle, this.swapyz);
		var transUniform = gl.getUniformLocation(this.program, "u_transform");
		gl.uniformMatrix4fv(transUniform, false, matrixMVP);

		// Bind the vertex buffer
		gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);

		// Set up the position attribute pointer
		var positionAttributeLocation = gl.getAttribLocation(this.program, "a_position");
		gl.enableVertexAttribArray(positionAttributeLocation);
		gl.vertexAttribPointer(positionAttributeLocation, 3, gl.FLOAT, false, 0, 0);

		// Set up matrixMV
		var transMVUniform = gl.getUniformLocation(this.program, "u_matrixMV");
		gl.uniformMatrix4fv(transMVUniform, false, matrixMV);

		// Set up matrixNormal
		var transNormalUniform = gl.getUniformLocation(this.program, "u_matrixNormal");
		gl.uniformMatrix3fv(transNormalUniform, false, matrixNormal);

		//Set up shininess
		var positionUniformLocation = gl.getUniformLocation(this.program, "u_shininess");
		gl.uniform1f(positionUniformLocation, this.shininess);

		// Set up light direction
		var positionUniformLocation = gl.getUniformLocation(this.program, "u_lightSource");
		gl.uniform3f(positionUniformLocation, this.lightDirection[0], this.lightDirection[1], this.lightDirection[2]);

		// Set up normal vector
		gl.bindBuffer(gl.ARRAY_BUFFER, this.normals);
		var positionAttributeLocation = gl.getAttribLocation(this.program, "a_normal");
		gl.enableVertexAttribArray(positionAttributeLocation);
		gl.vertexAttribPointer(positionAttributeLocation, 3, gl.FLOAT, false, 0, 0);

		if (this.showTex && this.loadedTexture){
			gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
			var texCoordAttributeLocation = gl.getAttribLocation(this.program, 'a_texCoord'); // attribute for texture coordinates
			gl.enableVertexAttribArray(texCoordAttributeLocation);
			gl.vertexAttribPointer(texCoordAttributeLocation, 2, gl.FLOAT, false, 0, 0);

			var textureUniformLocation = gl.getUniformLocation(this.program, 'u_texture'); // uniform for the texture
			gl.uniform1i(textureUniformLocation, 0); // set the texture unit to 0
		}

		gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
		gl.drawArrays(gl.TRIANGLES, 0, this.numTriangles);
	}
	
	// This method is called to set the texture of the mesh.
	// The argument is an HTML IMG element containing the texture data.
	setTexture( img )
	{
		// [TO-DO] Bind the texture
		gl.bindTexture(gl.TEXTURE_2D, this.texture);

		// You can set the texture image data using the following command.
		gl.texImage2D( gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img );

		// [TO-DO] Now that we have a texture, it might be a good idea to set
		// some uniform parameter(s) of the fragment shader, so that it uses the texture.
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); // repeat horizontally
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT); // repeat vertically

		this.loadedTexture = true;

		this.updateProgram();
	}
	
	// This method is called when the user changes the state of the
	// "Show Texture" checkbox. 
	// The argument is a boolean that indicates if the checkbox is checked.
	showTexture( show )
	{
		// [TO-DO] set the uniform parameter(s) of the fragment shader to specify if it should use the texture.
		this.showTex = show;

		this.updateProgram();
	}
	
	// This method is called to set the incoming light direction
	setLightDir( x, y, z )
	{
		// [TO-DO] set the uniform parameter(s) of the fragment shader to specify the light direction.
		this.lightDirection = [x, y, z];
	}
	
	// This method is called to set the shininess of the material
	setShininess( shininess )
	{
		// [TO-DO] set the uniform parameter(s) of the fragment shader to specify the shininess.
		this.shininess = shininess;
	}
}

function translationMatrix(tx, ty, tz) {
	return [
		1, 0, 0, 0,
		0, 1, 0, 0,
		0, 0, 1, 0,
		tx, ty, tz, 1
	];
}

function XRotationMatrix(angle) {
	const c = Math.cos(angle);
	const s = Math.sin(angle);
	return [
		1, 0, 0, 0,
		0, c, s, 0,
		0, -s, c, 0,
		0, 0, 0, 1
	];
}

function YRotationMatrix(angle) {
	const c = Math.cos(angle);
	const s = Math.sin(angle);
	return [
		c, 0, -s, 0,
		0, 1, 0, 0,
		s, 0, c, 0,
		0, 0, 0, 1
	];
}

function ZRotationMatrix(angle) {
	let c = Math.cos(angle);
	let s = Math.sin(angle);
	return [
		c, s, 0, 0,
		-s,  c, 0, 0,
		0,  0, 1, 0,
		0,  0, 0, 1
	];
}

function createTransformationMatrix(modelViewMatrix, point, angle, swapyz) {
	//point[2] += 0.1;
	let translationToOrigin;
    let translationBack;
	let rotationMatrix;
	if (swapyz){
    	rotationMatrix = ZRotationMatrix(angle);
		point = [point[0], point[2], point[1]];
		translationToOrigin = translationMatrix(0, point[1]+0.5, 0);
		translationBack = translationMatrix(0, -point[1]-0.5, 0);
	}else{
		rotationMatrix = YRotationMatrix(angle);
		translationToOrigin = translationMatrix(0, 0, point[2]+0.5);
		translationBack = translationMatrix(0, 0, -point[2]-0.5);
	}
    modelViewMatrix = MatrixMult(modelViewMatrix, translationToOrigin);
    modelViewMatrix = MatrixMult(modelViewMatrix, rotationMatrix);
    modelViewMatrix = MatrixMult(modelViewMatrix, translationBack);
	return modelViewMatrix;
}

GRAVITY = 9.81; // m/s^2
PENDULUM_LENGTH = 1; // m
MASS = 1;
dt = 0.005; // s

class Pendulum
{
	constructor(base=[0, 0, 0]) //
	{
		this.base = base;
		this.length = PENDULUM_LENGTH;
		this.angularVelocity = 0;
		this.angle = 1;
		this.x = undefined;
		this.y = undefined;
		this.computeCoord()
	}

	computeCoord()
	{
		this.y = this.length * Math.cos(this.angle);
		this.x = this.length * Math.sin(this.angle);
	}

	update(index, pendulums)
	{
		// Compute the new angle
		let angularAccel = 0;
		if (index == 0){
			let otherAngle = pendulums[1].angle;
			let otherAngularVelocity = pendulums[1].angularVelocity;
			angularAccel = (-GRAVITY*(2*MASS+MASS)*Math.sin(this.angle)-MASS*GRAVITY*Math.sin(this.angle-2*otherAngle)-2*Math.sin(this.angle-otherAngle)*MASS*(this.length*otherAngularVelocity*otherAngularVelocity+this.length*Math.cos(this.angle-otherAngle)*this.angularVelocity*this.angularVelocity))/(this.length*(2*MASS+MASS-MASS*Math.cos(2*(this.angle-otherAngle))));
		}else{
			let otherAngle = pendulums[0].angle;
			let otherAngularVelocity = pendulums[0].angularVelocity;
			angularAccel = (2*Math.sin(otherAngle-this.angle)*(this.length*(MASS+MASS)*otherAngularVelocity*otherAngularVelocity+GRAVITY*(MASS+MASS)*Math.cos(otherAngle)+this.length*MASS*this.angularVelocity*this.angularVelocity*Math.cos(otherAngle-this.angle)))/(this.length*(2*MASS+MASS-MASS*Math.cos(2*(otherAngle-this.angle))));
		}
		this.angularVelocity += angularAccel * dt;
		this.angle += this.angularVelocity * dt;
		this.computeCoord();
		//alert(this.x + ", " + this.y);
		return;
		this.angularVelocity += (MASS * GRAVITY / this.length * Math.sin(this.angle))*dt;
		this.angle += this.angularVelocity;
		this.computeCoord();
	}
}

class Simulation
{
	constructor(num_pendulums=2)
	{
		this.num_pendulums = num_pendulums;
		this.pendulums = [];
		for(let i = 0; i < this.num_pendulums; i++)
			this.pendulums.push(new Pendulum([0, 0, 0.5-i]));
	}

	update()
	{
		for (let i = 0; i < this.num_pendulums; i++)
			this.pendulums[i].update(i, this.pendulums);
	}
}