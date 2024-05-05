pipeline {
  agent any
  stages {
    stage("Install Bun") {
      steps {
        sh 'curl -fsSL https://bun.sh/install | bash -s "bun-v1.0.0"'
      }
    }
    stage("Install dependencies") {
      steps {
        sh 'bun install'
      }
    }
  }
}
